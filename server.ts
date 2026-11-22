import { sendNotification, WebPushError } from "web-push";
import type { PushSubscription, RequestOptions } from "web-push";
import { buildPayload, presets } from "./notification-presets";
import type { NotificationPreset } from "./notification-presets";

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

async function sendTo(
  subscription: PushSubscription,
  payload: string,
  options: RequestOptions,
): Promise<SendResult> {
  const pushService = new URL(subscription.endpoint).host;
  try {
    const response = await sendNotification(subscription, payload, options);
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

async function sendPreset(preset: NotificationPreset): Promise<SendResult[]> {
  const payload = buildPayload(preset);
  const options = { vapidDetails, TTL: 60, ...preset.push };
  const results = await Promise.all(
    [...subscriptions.values()].map((subscription) => sendTo(subscription, payload, options)),
  );
  console.log(new Date().toLocaleTimeString("ko-KR"), preset.id, JSON.stringify(results));
  return results;
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
    "/icon.png": () => staticFile("icon.png"),
    "/badge.png": () => staticFile("badge.png"),
    "/image.png": () => staticFile("image.png"),
    // 서비스 워커는 캐시되면 수정한 내용이 반영되지 않는다
    "/sw.js": () => staticFile("sw.js", { "Cache-Control": "no-cache" }),

    "/api/vapid-public-key": () => Response.json({ publicKey: VAPID_PUBLIC_KEY }),

    "/api/presets": () =>
      Response.json({ presets: presets.map(({ id, label, note }) => ({ id, label, note })) }),

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
      POST: async (request) => {
        const { presetId, delaySeconds = 0 } = (await request.json()) as {
          presetId?: string;
          delaySeconds?: number;
        };
        const preset = presets.find(({ id }) => id === presetId);
        if (!preset) {
          return Response.json({ error: "알 수 없는 알림 유형이에요" }, { status: 400 });
        }
        if (subscriptions.size === 0) {
          return Response.json({ error: "서버에 구독이 없어요. 먼저 구독하세요" }, { status: 409 });
        }

        // 앱을 닫거나 화면을 끈 상태에서 받아 보려면 누른 뒤에 시간이 필요하다
        const delay = Math.min(Math.max(Number(delaySeconds) || 0, 0), 60);
        if (delay > 0) {
          setTimeout(() => void sendPreset(preset), delay * 1000);
          return Response.json({ scheduledInSeconds: delay });
        }
        return Response.json({ results: await sendPreset(preset) });
      },
    },
  },
});

console.log(`Bun ${Bun.version} · ${server.url}`);
