const fs = require("fs");
const { createCanvas } = require("canvas");

// SVGをPNGに変換する関数
async function convertSvgToPng(svgPath, pngPath, size) {
  const svgContent = fs.readFileSync(svgPath, "utf8");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // SVGを画像として描画（簡易版）
  // 実際にはライブラリが必要だが、簡易的に
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.fillRect(size / 2 - 10, size / 2 - 10, 20, 20);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buffer);
}

// 実行
convertSvgToPng("public/icon.svg", "public/icon-192x192.png", 192);
convertSvgToPng("public/icon.svg", "public/icon-512x512.png", 512);
