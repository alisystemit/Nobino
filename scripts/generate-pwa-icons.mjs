/* تولید آیکون‌های PWA از روی SVG برند (با sharp که همراه Next است) */
import sharp from "sharp";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

async function main() {
  const svg = readFileSync(join(ICONS, "icon.svg"));

  // آیکون‌های استاندارد
  await sharp(svg).resize(192, 192).png().toFile(join(ICONS, "icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(join(ICONS, "icon-512.png"));
  await sharp(svg).resize(180, 180).png().toFile(join(ICONS, "apple-touch-icon.png"));
  await sharp(svg).resize(96, 96).png().toFile(join(ICONS, "favicon-96.png"));
  await sharp(svg).resize(32, 32).png().toFile(join(ICONS, "favicon-32.png"));

  // نسخه maskable با حاشیه امن (محتوا ۷۵٪)
  const maskable = Buffer.from(
    svg
      .toString("utf8")
      .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(64,64) scale(0.75)">')
      .replace("</svg>", "</g></svg>")
  );
  await sharp(maskable).resize(512, 512).png().toFile(join(ICONS, "icon-maskable-512.png"));

  console.log("✓ آیکون‌های PWA تولید شدند:", readdirSync(ICONS).join(", "));
}

main().catch((e) => {
  console.error("خطا در تولید آیکون:", e.message);
  process.exit(1);
});
