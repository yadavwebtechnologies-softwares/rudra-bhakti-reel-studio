
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance = null;
let ffmpegLoading = null;

async function getFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;

  if (!ffmpegLoading) {
    ffmpegLoading = (async () => {
      onProgress?.("Loading video engine for the first time...");

      const ffmpeg = new FFmpeg();
      const baseURL =
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }

  try {
    return await ffmpegLoading;
  } catch (error) {
    ffmpegLoading = null;
    throw error;
  }
}

function getSceneMotion(scene, index) {
  const text = `${scene.sceneTitle || ""} ${
    scene.sceneDescription || ""
  }`.toLowerCase();

  if (/meditat|dhyana|peace|serene|calm/.test(text)) {
    return {
      zoom: "min(zoom+0.00025,1.045)",
      x: "iw/2-(iw/zoom/2)",
      y: "ih/2-(ih/zoom/2)",
    };
  }

  if (/embrace|love|holding|together|compassion/.test(text)) {
    return {
      zoom: "max(1.0,1.06-on*0.00025)",
      x: "iw/2-(iw/zoom/2)",
      y: "ih/2-(ih/zoom/2)",
    };
  }

  if (/gaze|glance|look|vision|stargaz/.test(text)) {
    return {
      zoom: "1.055",
      x: "iw/2-(iw/zoom/2)+sin(on/100)*12",
      y: "ih/2-(ih/zoom/2)",
    };
  }

  if (/walk|journey|moving|travel/.test(text)) {
    return {
      zoom: "1.055",
      x: "iw/2-(iw/zoom/2)",
      y: "ih/2-(ih/zoom/2)+sin(on/110)*10",
    };
  }

  const motions = [
    {
      zoom: "min(zoom+0.0003,1.05)",
      x: "iw/2-(iw/zoom/2)",
      y: "ih/2-(ih/zoom/2)",
    },
    {
      zoom: "1.05",
      x: "iw/2-(iw/zoom/2)+sin(on/100)*10",
      y: "ih/2-(ih/zoom/2)",
    },
    {
      zoom: "max(1.0,1.055-on*0.0002)",
      x: "iw/2-(iw/zoom/2)",
      y: "ih/2-(ih/zoom/2)",
    },
  ];

  return motions[index % motions.length];
}

function getSceneTransition(scene, index) {
  const text = `${scene.sceneTitle || ""} ${
    scene.sceneDescription || ""
  }`.toLowerCase();

  if (/embrace|love|holding|together|compassion/.test(text)) {
    return "dissolve";
  }

  if (/meditat|dhyana|peace|serene|calm/.test(text)) {
    return "fade";
  }

  if (/gaze|glance|look|vision/.test(text)) {
    return "smoothleft";
  }

  if (/divine|light|blessing|aura/.test(text)) {
    return "circleopen";
  }

  if (/unity|final|togetherness|bliss/.test(text)) {
    return "fadeblack";
  }

  return index % 2 === 0 ? "fade" : "smoothleft";
}

export async function exportSilentReel({
  scenes,
  duration,
  onProgress,
}) {
  if (!scenes?.length) {
    throw new Error("No generated scenes are available to export.");
  }

  if (scenes.some((scene) => !scene.imageDataUrl)) {
    throw new Error("One or more scene images are missing.");
  }

  const ffmpeg = await getFFmpeg(onProgress);

  const totalSeconds = Number.parseInt(duration, 10) || 30;
  const transitionDuration = 0.65;
  const sceneCount = scenes.length;

  const clipDuration =
    (totalSeconds + transitionDuration * (sceneCount - 1)) /
    sceneCount;

  const filesToClean = [];
  const command = ["-filter_complex_threads", "1"];

  onProgress?.("Preparing your scene images...");

  for (let i = 0; i < scenes.length; i++) {
    const fileName = `rudra-scene-${i}.png`;

    await ffmpeg.writeFile(
      fileName,
      await fetchFile(scenes[i].imageDataUrl)
    );

    filesToClean.push(fileName);

    command.push(
      "-loop",
      "1",
      "-framerate",
      "30",
      "-t",
      clipDuration.toFixed(3),
      "-i",
      fileName
    );
  }

  const filters = [];

  for (let i = 0; i < sceneCount; i++) {
    const motion = getSceneMotion(scenes[i], i);

    filters.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,` +
        `crop=1080:1920,` +
        `zoompan=z='${motion.zoom}':` +
        `x='${motion.x}':y='${motion.y}':` +
        `d=1:s=1080x1920:fps=30,` +
        `trim=duration=${clipDuration.toFixed(3)},` +
        `setpts=PTS-STARTPTS,` +
        `setsar=1,format=yuv420p,settb=AVTB[v${i}]`
    );
  }

  let lastOutput = "v0";
  let accumulatedDuration = clipDuration;

  for (let i = 1; i < sceneCount; i++) {
    const outputName = `transition${i}`;
    const transition = getSceneTransition(scenes[i], i);

    const offset = accumulatedDuration - transitionDuration;

    filters.push(
      `[${lastOutput}][v${i}]xfade=` +
        `transition=${transition}:` +
        `duration=${transitionDuration}:` +
        `offset=${offset.toFixed(3)}[${outputName}]`
    );

    lastOutput = outputName;
    accumulatedDuration += clipDuration - transitionDuration;
  }

  const outputFile = "rudra-bhakti-final.mp4";
  filesToClean.push(outputFile);

  command.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${lastOutput}]`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-t",
    String(totalSeconds),
    "-movflags",
    "+faststart",
    outputFile
  );

  onProgress?.("Creating your silent MP4 with scene-specific motion and transitions...");

  try {
    await ffmpeg.exec(command);

    onProgress?.("Preparing your MP4 download...");

    const data = await ffmpeg.readFile(outputFile);

    return new Blob([data], {
      type: "video/mp4",
    });
  } finally {
    for (const fileName of filesToClean) {
      try {
        await ffmpeg.deleteFile(fileName);
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}
