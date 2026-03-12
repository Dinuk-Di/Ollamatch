import sharp from 'sharp';

const inputPath = 'C:/Users/LOQ/.gemini/antigravity/brain/3ba9353d-4433-413e-ba39-eb3d5045d4ed/browserassist_logo_1773167326520.png';
const outputPath = 'src/assets/logo.png';

async function processIcon() {
  try {
    const rectSvg = `<svg width="96" height="96"><rect x="0" y="0" width="96" height="96" rx="24" ry="24" /></svg>`;
    const roundedCorners = Buffer.from(rectSvg);

    const resized = await sharp(inputPath)
      .resize(96, 96, { fit: 'cover' })
      .toBuffer();

    const rounded = await sharp(resized)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      { input: rounded, top: 16, left: 16 }
    ])
    .png()
    .toFile(outputPath);
    
    console.log("Rounded 128x128 Padded Logo Created Successfully!");
  } catch(e) {
    console.error("Error processing icon:", e);
    process.exit(1);
  }
}
processIcon();
