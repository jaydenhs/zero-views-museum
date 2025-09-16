export const processImageForLEDStrip = async (
  imageUrl,
  width = 30,
  height = 30
) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const imgAspectRatio = img.width / img.height;
      const targetAspectRatio = width / height;

      let sourceX, sourceY, sourceWidth, sourceHeight;

      if (imgAspectRatio > targetAspectRatio) {
        sourceHeight = img.height;
        sourceWidth = img.height * targetAspectRatio;
        sourceX = (img.width - sourceWidth) / 2;
        sourceY = 0;
      } else {
        sourceWidth = img.width;
        sourceHeight = img.width / targetAspectRatio;
        sourceX = 0;
        sourceY = (img.height - sourceHeight) / 2;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
      );

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b);
        let h,
          s,
          l = (max + min) / 2;
        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r:
              h = (g - b) / d + (g < b ? 6 : 0);
              break;
            case g:
              h = (b - r) / d + 2;
              break;
            case b:
              h = (r - g) / d + 4;
              break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          }
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      const SATURATION_BOOST = 1.5;
      const ledArray = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const actualX = y % 2 === 1 ? width - 1 - x : x;
          const pixelIndex = (y * width + actualX) * 4;
          let r = pixels[pixelIndex];
          let g = pixels[pixelIndex + 1];
          let b = pixels[pixelIndex + 2];
          let [h, s, l] = rgbToHsl(r, g, b);
          s = Math.min(s * SATURATION_BOOST, 1);
          [r, g, b] = hslToRgb(h, s, l);
          ledArray.push(r, g, b);
        }
      }

      resolve(ledArray);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
};
