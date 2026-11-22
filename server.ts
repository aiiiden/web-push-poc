import { sendNotification, WebPushError } from "web-push";
import type { PushSubscription } from "web-push";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("VAPID 키가 없어요. 먼저 `bun run keys`를 실행하세요");
  process.exit(1);
}

const vapidDetails = {
  subject: VAPID_SUBJECT ?? "mailto:admin@example.com",
  publicKey: VAPID_PUBLIC_KEY,
  privateKey: VAPID_PRIVATE_KEY,
};

// 검증용이라 메모리에만 둔다. 서버를 다시 켜면 사라진다
const subscriptions = new Map<string, PushSubscription>();

interface SendResult {
  pushService: string;
  status: number | string;
}

async function sendTo(subscription: PushSubscription, payload: string): Promise<SendResult> {
  const pushService = new URL(subscription.endpoint).host;
  try {
    const response = await sendNotification(subscription, payload, { vapidDetails, TTL: 60 });
    return { pushService, status: response.statusCode };
  } catch (error) {
    if (error instanceof WebPushError) {
      // 404, 410은 구독이 만료되었거나 취소되었다는 뜻이다
      if (error.statusCode === 404 || error.statusCode === 410) {
        subscriptions.delete(subscription.endpoint);
      }
      return { pushService, status: error.statusCode };
    }
    return { pushService, status: error instanceof Error ? error.message : String(error) };
  }
}

function staticFile(name: string, headers: Record<string, string> = {}) {
  return new Response(Bun.file(new URL(`./public/${name}`, import.meta.url)), { headers });
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/": () => staticFile("index.html"),
    "/app.js": () => staticFile("app.js"),
    "/manifest.webmanifest": () => staticFile("manifest.webmanifest"),
    // 서비스 워커는 캐시되면 수정한 내용이 반영되지 않는다
    "/sw.js": () => staticFile("sw.js", { "Cache-Control": "no-cache" }),

    "/api/vapid-public-key": () => Response.json({ publicKey: VAPID_PUBLIC_KEY }),

    "/api/subscribe": {
      POST: async (request) => {
        const subscription = (await request.json()) as PushSubscription;
        if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
          return Response.json({ error: "구독 형식이 올바르지 않아요" }, { status: 400 });
        }
        subscriptions.set(subscription.endpoint, subscription);
        return Response.json({ count: subscriptions.size });
      },
    },

    "/api/unsubscribe": {
      POST: async (request) => {
        const { endpoint } = (await request.json()) as { endpoint: string };
        subscriptions.delete(endpoint);
        return Response.json({ count: subscriptions.size });
      },
    },

    "/api/send-test": {
      POST: async () => {
        const payload = JSON.stringify({
          title: "web-push-poc",
          body: `테스트 알림 ${new Date().toLocaleTimeString("ko-KR")}`,
          url: "/",
        });
        const results = await Promise.all(
          [...subscriptions.values()].map((subscription) => sendTo(subscription, payload)),
        );
        return Response.json({ results });
      },
    },
  },
});

console.log(`Bun ${Bun.version} · ${server.url}`);
