import type { RequestOptions } from "web-push";

/** 서비스 워커가 `showNotification(title, options)`에 그대로 넘기는 내용 */
interface NotificationContent {
  title: string;
  options?: Record<string, unknown>;
  /** 알림을 눌렀을 때 열 주소 */
  url?: string;
}

export interface NotificationPreset {
  id: string;
  label: string;
  /** 어느 기기에서 무엇을 보면 되는지 */
  note: string;
  content: NotificationContent;
  /** 푸시 서비스에 주는 전송 옵션 (긴급도, 보관 시간 등) */
  push?: Pick<RequestOptions, "urgency" | "TTL" | "topic">;
}

/** 페이지에 버튼으로 나열되는 테스트 알림 유형 */
export const presets: NotificationPreset[] = [
  {
    id: "basic",
    label: "기본",
    note: "제목과 본문만",
    content: { title: "기본 알림", options: { body: "제목과 본문만 있는 알림이에요" } },
  },
  {
    id: "title-only",
    label: "제목만",
    note: "본문이 없을 때의 모양",
    content: { title: "제목만 있는 알림" },
  },
  {
    id: "long",
    label: "긴 본문",
    note: "어디서 잘리는지, 펼치면 다 보이는지",
    content: {
      title: "긴 본문 알림입니다 제목도 길게 써서 어디에서 잘리는지 봅니다",
      options: {
        body: "첫째 줄입니다.\n둘째 줄입니다.\n".concat("본문이 길어지면 기기마다 잘리는 위치가 달라요. ".repeat(6)),
      },
    },
  },
  {
    id: "icon",
    label: "아이콘과 배지",
    note: "icon은 알림 옆 그림, badge는 Android 상태 표시줄의 작은 단색 그림",
    content: {
      title: "아이콘과 배지",
      options: { body: "icon과 badge를 지정했어요", icon: "/icon.png", badge: "/badge.png" },
    },
  },
  {
    id: "image",
    label: "큰 이미지",
    note: "Android·데스크탑 Chrome만 지원. iPhone은 무시",
    content: {
      title: "큰 이미지",
      options: { body: "펼치면 그림이 보여요", icon: "/icon.png", image: "/image.png" },
    },
  },
  {
    id: "actions",
    label: "버튼",
    note: "Android·데스크탑 Chrome만 지원. 어느 버튼을 눌렀는지 열린 페이지의 기록에 나와요",
    content: {
      title: "버튼이 있는 알림",
      options: {
        body: "아래 버튼을 눌러 보세요",
        actions: [
          { action: "confirm", title: "확인" },
          { action: "later", title: "나중에" },
        ],
      },
    },
  },
  {
    id: "tag",
    label: "같은 알림 교체",
    note: "여러 번 눌러도 알림이 쌓이지 않고 하나가 바뀌어요 (tag)",
    content: {
      title: "교체되는 알림",
      options: { body: "발송 시각: {time}", tag: "replace-me", renotify: true },
    },
  },
  {
    id: "stack",
    label: "쌓이는 알림",
    note: "tag 없이 여러 번 보내면 어떻게 묶이는지",
    content: { title: "쌓이는 알림", options: { body: "발송 시각: {time}" } },
  },
  {
    id: "silent",
    label: "조용히",
    note: "소리와 진동 없이 (silent)",
    content: { title: "조용한 알림", options: { body: "소리와 진동이 없어야 해요", silent: true } },
  },
  {
    id: "vibrate",
    label: "진동 패턴",
    note: "Android만 지원. 짧게 세 번",
    content: {
      title: "진동 패턴",
      options: { body: "짧게 세 번 울려요", vibrate: [100, 80, 100, 80, 100] },
    },
  },
  {
    id: "sticky",
    label: "닫을 때까지 유지",
    note: "데스크탑 Chrome에서 저절로 사라지지 않아요 (requireInteraction)",
    content: {
      title: "닫을 때까지 유지",
      options: { body: "직접 닫아야 사라져요", requireInteraction: true },
    },
  },
  {
    id: "deep-link",
    label: "다른 화면으로 열기",
    note: "알림을 누르면 주소에 ?from=deep-link가 붙어 열려요",
    content: {
      title: "다른 화면으로 열기",
      options: { body: "눌러서 어떤 주소로 열리는지 확인하세요" },
      url: "/?from=deep-link",
    },
  },
  {
    id: "urgent",
    label: "긴급도 높음",
    note: "기기가 절전 중이어도 바로 깨워서 전달 (Urgency: high)",
    content: { title: "긴급도 높음", options: { body: "발송 시각: {time}" } },
    push: { urgency: "high" },
  },
  {
    id: "low",
    label: "긴급도 낮음",
    note: "절전 중이면 늦게 올 수 있어요 (Urgency: very-low). 화면을 끄고 보내 보세요",
    content: { title: "긴급도 낮음", options: { body: "발송 시각: {time}" } },
    push: { urgency: "very-low" },
  },
  {
    id: "expire",
    label: "보관하지 않음",
    note: "기기가 꺼져 있으면 버려져요 (TTL 0). 비행기 모드에서 보내고 켜 보세요",
    content: { title: "보관하지 않는 알림", options: { body: "발송 시각: {time}" } },
    push: { TTL: 0 },
  },
];

/** 발송 직전에 `{time}` 자리를 현재 시각으로 채운 페이로드를 만든다 */
export function buildPayload(preset: NotificationPreset): string {
  const time = new Date().toLocaleTimeString("ko-KR");
  return JSON.stringify(preset.content).replaceAll("{time}", time);
}
