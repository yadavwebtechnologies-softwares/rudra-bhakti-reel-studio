
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

// Reel-specific deterministic variation.
function seededIndex(seed, index, length) {
  let value = (seed + index * 374761393) | 0;

  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;

  return (value >>> 0) % length;
}

// Smoothly interpolate five keyframes.
function keyframeExpression(values, frameCount) {
  const lastFrame = Math.max(4, frameCount - 1);

  const frames = values.map((_, index) =>
    Math.round((lastFrame * index) / (values.length - 1))
  );

  let expression = String(values[values.length - 1]);

  for (let i = values.length - 2; i >= 0; i--) {
    const startFrame = frames[i];
    const endFrame = frames[i + 1];
    const frameLength = Math.max(1, endFrame - startFrame);

    const segment =
      `${values[i]}+(${values[i + 1]}-${values[i]})*` +
      `(0.5-0.5*cos(PI*(on-${startFrame})/${frameLength}))`;

    expression =
      `if(lte(on,${endFrame}),${segment},${expression})`;
  }

  return expression;
}

const MOTION_LIBRARY = {
  cinematicPush: {
    zoom: [1.0, 1.015, 1.035, 1.055, 1.075],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },

  gentlePullback: {
    zoom: [1.085, 1.07, 1.05, 1.035, 1.02],
    panX: [0.5, 0.5, 0.49, 0.5, 0.5],
    panY: [0.5, 0.5, 0.5, 0.51, 0.5],
  },

  horizontalLeft: {
    zoom: [1.065, 1.065, 1.065, 1.065, 1.065],
    panX: [0.75, 0.62, 0.5, 0.38, 0.25],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },

  horizontalRight: {
    zoom: [1.065, 1.065, 1.065, 1.065, 1.065],
    panX: [0.25, 0.38, 0.5, 0.62, 0.75],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },

  verticalRise: {
    zoom: [1.045, 1.055, 1.065, 1.075, 1.085],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.72, 0.62, 0.5, 0.38, 0.28],
  },

  verticalFall: {
    zoom: [1.08, 1.07, 1.06, 1.05, 1.04],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.25, 0.38, 0.5, 0.62, 0.75],
  },

  diagonalDrift: {
    zoom: [1.04, 1.05, 1.06, 1.07, 1.08],
    panX: [0.28, 0.38, 0.5, 0.62, 0.72],
    panY: [0.72, 0.62, 0.5, 0.38, 0.28],
  },

  softReveal: {
    zoom: [1.0, 1.025, 1.05, 1.065, 1.075],
    panX: [0.62, 0.58, 0.52, 0.48, 0.5],
    panY: [0.58, 0.55, 0.5, 0.47, 0.5],
  },

  intimateFocus: {
    zoom: [1.075, 1.08, 1.085, 1.09, 1.085],
    panX: [0.5, 0.48, 0.5, 0.52, 0.5],
    panY: [0.5, 0.48, 0.5, 0.52, 0.5],
  },

  peacefulHold: {
    zoom: [1.035, 1.04, 1.045, 1.05, 1.05],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
};

function getSceneMotion(scene, index, seed, previousMotion) {
  const text = `${scene.sceneTitle || ""} ${
    scene.sceneDescription || ""
  }`.toLowerCase();

  let candidates;

  if (/meditat|dhyana|peace|serene|calm|prayer/.test(text)) {
    candidates = [
      "peacefulHold",
      "cinematicPush",
      "verticalRise",
      "gentlePullback",
    ];
  } else if (
    /embrace|love|holding|together|compassion|affection/.test(text)
  ) {
    candidates = [
      "gentlePullback",
      "intimateFocus",
      "cinematicPush",
      "softReveal",
    ];
  } else if (
    /gaze|glance|look|vision|stargaz|staring/.test(text)
  ) {
    candidates = [
      "horizontalLeft",
      "horizontalRight",
      "intimateFocus",
      "softReveal",
    ];
  } else if (/walk|journey|moving|travel/.test(text)) {
    candidates = [
      "diagonalDrift",
      "horizontalLeft",
      "horizontalRight",
      "verticalRise",
    ];
  } else if (
    /blessing|divine|aura|light|darshan|appearance/.test(text)
  ) {
    candidates = [
      "softReveal",
      "cinematicPush",
      "verticalRise",
      "gentlePullback",
    ];
  } else {
    candidates = [
      "cinematicPush",
      "gentlePullback",
      "horizontalLeft",
      "horizontalRight",
      "verticalRise",
      "verticalFall",
      "diagonalDrift",
      "softReveal",
      "intimateFocus",
      "peacefulHold",
    ];
  }

  const available = candidates.filter(
    (name) => name !== previousMotion
  );

  const selected =
    available[seededIndex(seed, index, available.length)];

  return {
    name: selected,
    ...MOTION_LIBRARY[selected],
  };
}

function getSceneTransition(scene, index, seed, previousTransition) {
  const text = `${scene.sceneTitle || ""} ${
    scene.sceneDescription || ""
  }`.toLowerCase();

  let candidates;

  if (/embrace|love|holding|together|compassion/.test(text)) {
    candidates = ["dissolve", "fade", "smoothright"];
  } else if (/meditat|dhyana|peace|serene|calm/.test(text)) {
    candidates = ["fade", "dissolve", "fadeblack"];
  } else if (/gaze|glance|look|vision|stargaz/.test(text)) {
    candidates = ["smoothleft", "smoothright", "wipeleft"];
  } else if (/divine|light|blessing|aura|darshan/.test(text)) {
    candidates = ["circleopen", "dissolve", "fade"];
  } else if (/walk|journey|moving|travel/.test(text)) {
    candidates = ["slideright", "smoothleft", "wiperight"];
  } else if (/unity|final|togetherness|bliss|ending/.test(text)) {
    candidates = ["fadeblack", "fade", "dissolve"];
  } else {
    candidates = [
      "dissolve",
      "smoothleft",
      "smoothright",
      "fade",
      "wipeleft",
      "slideright",
    ];
  }

  const available = candidates.filter(
    (name) => name !== previousTransition
  );

  return available[
    seededIndex(seed ^ 0x5f3759df, index, available.length)
  ];
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

  const frameCount = Math.max(2, Math.round(clipDuration * 30));

  // A fresh seed gives each export its own animation arrangement.
  const reelSeed = Math.floor(Math.random() * 0x7fffffff);

  const filesToClean = [];
  const command = ["-filter_complex_threads", "1"];

  try {
    onProgress?.("Preparing your scene images...");

    for (let i = 0; i < sceneCount; i++) {
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
    let previousMotion = null;
    let previousTransition = null;

    // Build a different camera animation for every scene.
    for (let i = 0; i < sceneCount; i++) {
      const motion = getSceneMotion(
        scenes[i],
        i,
        reelSeed,
        previousMotion
      );

      previousMotion = motion.name;

      const zoom = keyframeExpression(motion.zoom, frameCount);
      const panX = keyframeExpression(motion.panX, frameCount);
      const panY = keyframeExpression(motion.panY, frameCount);

      filters.push(
        `[${i}:v]` +
          `scale=1080:1920:force_original_aspect_ratio=increase,` +
          `crop=1080:1920,` +
          `zoompan=` +
          `z='${zoom}':` +
          `x='(iw-iw/zoom)*(${panX})':` +
          `y='(ih-ih/zoom)*(${panY})':` +
          `d=1:s=1080x1920:fps=30,` +
          `trim=duration=${clipDuration.toFixed(3)},` +
          `setpts=PTS-STARTPTS,` +
          `setsar=1,` +
          `format=yuv420p,` +
          `settb=AVTB[v${i}]`
      );
    }

    // Join scenes using varied, mood-matched transitions.
    let lastOutput = "v0";
    let accumulatedDuration = clipDuration;

    for (let i = 1; i < sceneCount; i++) {
      const outputName = `transition${i}`;

      const transition = getSceneTransition(
        scenes[i],
        i,
        reelSeed,
        previousTransition
      );

      previousTransition = transition;

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

    onProgress?.(
      "Creating your Reel with unique keyframe animations and transitions..."
    );

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
