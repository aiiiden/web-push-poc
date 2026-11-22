const $ = (id) => document.getElementById(id);

function log(message) {
  $("log").textContent = `${new Date().toLocaleTimeString("ko-KR")} ${message}\n${$("log").textContent}`;
}

const supported =
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return response.json();
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function render() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("display").textContent = standalone ? "설치된 앱" : "브라우저";

  if (!supported) {
    // iPhone은 홈 화면에 추가한 앱으로 열어야 PushManager가 생긴다
    $("support").textContent = "지원 안 함 (iPhone이면 홈 화면에 추가한 뒤 앱으로 열기)";
    $("permission").textContent = "-";
    $("subscription").textContent = "-";
    return;
  }

  $("support").textContent = "지원함";
  $("permission").textContent = Notification.permission;
  const subscription = await currentSubscription();
  $("subscription").textContent = subscription
    ? `있음 (${new URL(subscription.endpoint).host})`
    : "없음";
}

async function subscribe() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    log(`권한이 허용되지 않았어요: ${permission}`);
    return;
  }

  const { publicKey } = await (await fetch("/api/vapid-public-key")).json();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    // 알림을 보여 주지 않는 푸시는 브라우저가 허용하지 않는다
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  });

  const { count } = await postJson("/api/subscribe", subscription.toJSON());
  log(`구독했어요. 푸시 서비스: ${new URL(subscription.endpoint).host}, 서버의 구독 수: ${count}`);
}

async function unsubscribe() {
  const subscription = await currentSubscription();
  if (!subscription) {
    log("구독이 없어요");
    return;
  }
  await subscription.unsubscribe();
  await postJson("/api/unsubscribe", { endpoint: subscription.endpoint });
  log("구독을 취소했어요");
}

async function sendTest() {
  // 서버를 다시 켜면 서버 쪽 구독이 사라지므로 보내기 전에 다시 알려 준다
  const subscription = await currentSubscription();
  if (subscription) await postJson("/api/subscribe", subscription.toJSON());

  const { results } = await postJson("/api/send-test");
  if (results.length === 0) {
    log("서버에 구독이 없어요. 먼저 구독하세요");
    return;
  }
  for (const { pushService, status } of results) {
    log(`발송 결과: ${pushService} → ${status} (201이면 푸시 서비스가 받았다는 뜻)`);
  }
}

function bind(id, action) {
  $(id).addEventListener("click", async () => {
    try {
      await action();
    } catch (error) {
      log(`오류: ${error.message}`);
    }
    await render();
  });
}

if (supported) {
  await navigator.serviceWorker.register("/sw.js");
  bind("subscribe", subscribe);
  bind("unsubscribe", unsubscribe);
  bind("send", sendTest);
} else {
  for (const id of ["subscribe", "unsubscribe", "send"]) $(id).disabled = true;
}

await render();
