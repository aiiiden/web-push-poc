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

async function sendTest(presetId) {
  // 서버를 다시 켜면 서버 쪽 구독이 사라지므로 보내기 전에 다시 알려 준다
  const subscription = await currentSubscription();
  if (subscription) await postJson("/api/subscribe", subscription.toJSON());

  const delaySeconds = $("delay").checked ? 10 : 0;
  const { results, scheduledInSeconds, error } = await postJson("/api/send-test", {
    presetId,
    delaySeconds,
  });
  if (error) {
    log(error);
    return;
  }
  if (scheduledInSeconds) {
    log(`${presetId}: ${scheduledInSeconds}초 뒤에 보내요`);
    return;
  }
  for (const { pushService, status } of results) {
    log(`${presetId}: ${pushService} → ${status} (201이면 푸시 서비스가 받았다는 뜻)`);
  }
}

async function renderPresets() {
  const { presets } = await (await fetch("/api/presets")).json();
  for (const { id, label, note } of presets) {
    const button = document.createElement("button");
    button.id = `send-${id}`;
    button.textContent = label;
    button.disabled = !supported;
    const description = document.createElement("p");
    description.className = "note";
    description.textContent = note;
    $("presets").append(button, description);
    if (supported) bind(button.id, () => sendTest(id));
  }
}

// 알림을 눌러서 열렸으면 어떤 주소로 열렸는지 보여 준다
function logLaunchParams() {
  const params = new URLSearchParams(location.search);
  if (params.size > 0) log(`알림으로 열림: ${location.search}`);
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
} else {
  for (const id of ["subscribe", "unsubscribe"]) $(id).disabled = true;
}

await renderPresets();
logLaunchParams();

await render();
