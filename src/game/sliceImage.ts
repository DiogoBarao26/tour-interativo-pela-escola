export async function sliceImage(url: string, rows: number): Promise<string[]> {
  const image = url.startsWith('data:') || url.startsWith('blob:') ? await load(url) : await load(url).catch(() => drawSchool());
  const width = image instanceof HTMLImageElement ? image.naturalWidth || 1200 : image.width;
  const height = image instanceof HTMLImageElement ? image.naturalHeight || 800 : image.height;
  const pieceWidth = Math.max(1, Math.floor(width / rows));
  const pieceHeight = Math.max(1, Math.floor(height / rows));
  const pieces: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < rows; column += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.drawImage(
        image,
        column * pieceWidth,
        row * pieceHeight,
        pieceWidth,
        pieceHeight,
        0,
        0,
        pieceWidth,
        pieceHeight,
      );
      pieces.push(canvas.toDataURL('image/jpeg', 0.86));
    }
  }
  return pieces;
}

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('imagem'));
    image.src = url;
  });
}

function drawSchool() {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.fillStyle = '#9fd7ef';
  context.fillRect(0, 0, 900, 600);
  context.fillStyle = '#f6d365';
  context.beginPath();
  context.arc(760, 90, 48, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#7dce82';
  context.fillRect(0, 430, 900, 170);
  context.fillStyle = '#2f6f4e';
  context.beginPath();
  context.arc(120, 430, 70, Math.PI, 0);
  context.fill();
  context.fillStyle = '#e25b45';
  context.beginPath();
  context.moveTo(180, 250);
  context.lineTo(450, 120);
  context.lineTo(720, 250);
  context.closePath();
  context.fill();
  context.fillStyle = '#f7f1e3';
  context.fillRect(230, 250, 440, 230);
  context.fillStyle = '#efbf4a';
  context.fillRect(410, 360, 80, 120);
  const windows = [
    [270, 290],
    [340, 290],
    [520, 290],
    [600, 290],
    [270, 370],
    [600, 370],
  ];
  windows.forEach(([x, y], index) => {
    context.fillStyle = index % 2 === 0 ? '#7ec8e3' : '#2457a6';
    context.fillRect(x!, y!, 54, 44);
  });
  context.fillStyle = '#1d4e89';
  context.fillRect(500, 180, 16, 70);
  context.fillStyle = '#f4d35e';
  context.fillRect(516, 188, 36, 22);
  return canvas;
}
