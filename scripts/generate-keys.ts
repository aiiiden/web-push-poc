import { generateVAPIDKeys } from "web-push";

const envPath = new URL("../.env", import.meta.url).pathname;

// 키를 바꾸면 기존 구독이 전부 무효가 되므로 덮어쓰지 않는다
if (await Bun.file(envPath).exists()) {
  console.error(".env가 이미 있어요. 새 키가 필요하면 .env를 지우고 다시 실행하세요");
  process.exit(1);
}

const { publicKey, privateKey } = generateVAPIDKeys();

await Bun.write(
  envPath,
  [
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    "VAPID_SUBJECT=mailto:admin@example.com",
    "PORT=3000",
    "",
  ].join("\n"),
);

console.log(".env에 VAPID 키 쌍을 저장했어요");
console.log(`공개 키: ${publicKey}`);
