
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 30;
const OUTPUT_FILE = "rudra-bhakti-final.mp4";

let ffmpegInstance = null;
let ffmpegLoading = null;
let exportInProgress = false;

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

function seededIndex(seed, index, length) {
  if (length <= 1) return 0;

  let value = (seed + index * 374761393) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;

  return (value >>> 0) % length;
}

function keyframeExpression(values, frameCount) {
  if (!Array.isArray(values) || values.length !== 5) {
    throw new Error("Each camera move must contain exactly five keyframes.");
  }

  const lastFrame = Math.max(4, frameCount - 1);
  const frames = values.map((_, index) =>
    Math.round((lastFrame * index) / 4)
  );

  let expression = String(values[4]);

  for (let i = 3; i >= 0; i--) {
    const startFrame = frames[i];
    const endFrame = frames[i + 1];
    const frameLength = Math.max(1, endFrame - startFrame);

    // Cosine easing creates a gentle ease-in/ease-out between keyframes.
    const segment =
      `${values[i]}+(${values[i + 1]}-${values[i]})*` +
      `(0.5-0.5*cos(PI*(on-${startFrame})/${frameLength}))`;

    expression = `if(lte(on,${endFrame}),${segment},${expression})`;
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
    zoom: [1.06, 1.065, 1.07, 1.065, 1.06],
    panX: [0.76, 0.63, 0.5, 0.37, 0.24],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
  horizontalRight: {
    zoom: [1.06, 1.065, 1.07, 1.065, 1.06],
    panX: [0.24, 0.37, 0.5, 0.63, 0.76],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
  verticalRise: {
    zoom: [1.045, 1.055, 1.065, 1.075, 1.085],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.74, 0.62, 0.5, 0.38, 0.26],
  },
  verticalFall: {
    zoom: [1.08, 1.07, 1.06, 1.05, 1.04],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.26, 0.38, 0.5, 0.62, 0.74],
  },
  diagonalDrift: {
    zoom: [1.04, 1.05, 1.06, 1.07, 1.08],
    panX: [0.28, 0.39, 0.5, 0.61, 0.72],
    panY: [0.72, 0.61, 0.5, 0.39, 0.28],
  },
  softReveal: {
    zoom: [1.0, 1.02, 1.045, 1.065, 1.08],
    panX: [0.64, 0.59, 0.53, 0.48, 0.5],
    panY: [0.6, 0.56, 0.51, 0.47, 0.5],
  },
  intimateFocus: {
    zoom: [1.07, 1.08, 1.09, 1.09, 1.08],
    panX: [0.5, 0.48, 0.5, 0.52, 0.5],
    panY: [0.5, 0.48, 0.5, 0.52, 0.5],
  },
  peacefulHold: {
    zoom: [1.025, 1.03, 1.035, 1.04, 1.04],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.5, 0.5, 0.5, 0.5, 0.5],
  },
  slowTiltUp: {
    zoom: [1.035, 1.045, 1.055, 1.065, 1.075],
    panX: [0.5, 0.5, 0.5, 0.5, 0.5],
    panY: [0.66, 0.58, 0.5, 0.42, 0.34],
  },
  subtleFloat: {
    zoom: [1.045, 1.05, 1.055, 1.05, 1.045],
    panX: [0.47, 0.49, 0.52, 0.51, 0.48],
    panY: [0.48, 0.51, 0.49, 0.47, 0.5],
  },
};

function getSceneText(scene) {
  return [
    scene?.sceneTitle,
    scene?.sceneDescription,
    scene?.imagePrompt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSceneMood(scene) {
  const text = getSceneText(scene);

  if (
    /ध्यान|ध्यानमग्न|तपस्या|शांत|शांति|समाधि|प्रार्थना|आराधना|पूजा|meditat|dhyana|peace|serene|calm|prayer|worship/.test(text)
  ) return "peaceful";

  if (
    /आलिंगन|गले लग|प्रेम|स्नेह|मिलन|करुणा|वात्सल्य|embrace|love|holding|together|compassion|affection/.test(text)
  ) return "emotional";

  if (
    /आशीर्वाद|वरदान|कृपा|दिव्य|प्रकट|अवतार|ज्योति|प्रकाश|आभा|दर्शन|blessing|divine|aura|light|darshan|appearance|manifest/.test(text)
  ) return "divine";

  if (
    /निहार|देखते|देखना|दृष्टि|नज़र|नजर|गगन|gaze|glance|look|vision|stargaz|staring/.test(text)
  ) return "gaze";

  if (
    /चलते|यात्रा|प्रस्थान|आगमन|आगे बढ़|कदम|walk|journey|moving|travel|arrival|departure/.test(text)
  ) return "movement";

  if (
    /अंतिम|समापन|एकता|आनंद|पूर्ण|अंतिम दृश्य|final|togetherness|bliss|ending|reunion/.test(text)
  ) return "ending";

  return "general";
}

function chooseWithoutImmediateRepeat(candidates, previous, seed, index) {
  const available = candidates.filter((name) => name !== previous);
  const pool = available.length ? available : candidates;
  return pool[seededIndex(seed, index, pool.length)];
}

function getSceneMotion(scene, index, seed, previousMotion) {
  const mood = getSceneMood(scene);

  const motionSets = {
    peaceful: [
      "peacefulHold",
      "cinematicPush",
      "verticalRise",
      "gentlePullback",
      "slowTiltUp",
    ],
    emotional: [
      "gentlePullback",
      "intimateFocus",
      "cinematicPush",
      "softReveal",
      "subtleFloat",
    ],
    divine: [
      "softReveal",
      "cinematicPush",
      "verticalRise",
      "gentlePullback",
      "slowTiltUp",
    ],
    gaze: [
      "horizontalLeft",
      "horizontalRight",
      "intimateFocus",
      "softReveal",
      "subtleFloat",
    ],
    movement: [
      "diagonalDrift",
      "horizontalLeft",
      "horizontalRight",
      "verticalRise",
      "verticalFall",
    ],
    ending: [
      "gentlePullback",
      "peacefulHold",
      "softReveal",
      "cinematicPush",
    ],
    general: Object.keys(MOTION_LIBRARY),
  };

  const selected = chooseWithoutImmediateRepeat(
    motionSets[mood],
    previousMotion,
    seed,
    index
  );

  return {
    name: selected,
    ...MOTION_LIBRARY[selected],
  };
}

function getSceneTransition(scene, index, seed, previousTransition) {
  const mood = getSceneMood(scene);

  const transitionSets = {
    peaceful: ["fade", "dissolve", "fadeblack", "smoothdown"],
    emotional: ["dissolve", "fade", "smoothright", "smoothleft"],
    divine: ["circleopen", "dissolve", "fade", "fadewhite"],
    gaze: ["smoothleft", "smoothright", "wipeleft", "wiperight"],
    movement: ["slideright", "slideleft", "smoothleft", "wiperight"],
    ending: ["fadeblack", "fade", "dissolve", "circleclose"],
    general: [
      "dissolve",
      "smoothleft",
      "smoothright",
      "smoothup",
      "smoothdown",
      "fade",
      "wipeleft",
      "wiperight",
      "slideright",
      "slideleft",
    ],
  };

  return chooseWithoutImmediateRepeat(
    transitionSets[mood],
    previousTransition,
    seed ^ 0x5f3759df,
    index
  );
}

function formatSeconds(value) {
  return Number(value).toFixed(3);
}

export async function exportSilentReel({
  scenes,
  duration,
  onProgress,
}) {
  if (exportInProgress) {
    throw new Error("A Reel export is already running. Please wait for it to finish.");
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("No generated scenes are available to export.");
  }

  if (scenes.some((scene) => !scene?.imageDataUrl)) {
    throw new Error("One or more scene images are missing.");
  }

  const parsedDuration = Number.parseFloat(duration);
  const totalSeconds = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? Math.min(180, Math.max(5, parsedDuration))
    : 30;

  const sceneCount = scenes.length;
  const transitionDuration = Math.min(0.8, Math.max(0.45, totalSeconds / sceneCount * 0.18));
  const clipDuration =
    (totalSeconds + transitionDuration * (sceneCount - 1)) / sceneCount;
  const frameCount = Math.max(2, Math.ceil(clipDuration * FPS));

  // Each export gets a new motion/transition arrangement.
  const reelSeed = Math.floor(Math.random() * 0x7fffffff);
  const filesToClean = [];
  let ffmpeg = null;

  exportInProgress = true;

  try {
    ffmpeg = await getFFmpeg(onProgress);
    onProgress?.("Preparing portrait scenes and cinematic camera moves...");

    const command = ["-filter_complex_threads", "1"];

    for (let i = 0; i < sceneCount; i++) {
      const fileName = `rudra-scene-${i}.png`;
      const imageBytes = await fetchFile(scenes[i].imageDataUrl);

      if (!imageBytes || imageBytes.length === 0) {
        throw new Error(`Scene ${i + 1} image could not be read.`);
      }

      await ffmpeg.writeFile(fileName, imageBytes);
      filesToClean.push(fileName);

      command.push(
        "-loop", "1",
        "-framerate", String(FPS),
        "-t", formatSeconds(clipDuration),
        "-i", fileName
      );
    }

    const filters = [];
    let previousMotion = null;
    let previousTransition = null;

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
          `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,` +
          `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},` +
          `zoompan=` +
          `z='${zoom}':` +
          `x='(iw-iw/zoom)*(${panX})':` +
          `y='(ih-ih/zoom)*(${panY})':` +
          `d=1:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${FPS},` +
          `trim=duration=${formatSeconds(clipDuration)},` +
          `setpts=PTS-STARTPTS,` +
          `eq=contrast=1.035:saturation=1.045:brightness=0.002,` +
          `unsharp=5:5:0.25:3:3:0.0,` +
          `setsar=1,` +
          `format=yuv420p,` +
          `settb=AVTB[v${i}]`
      );
    }

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
          `duration=${formatSeconds(transitionDuration)}:` +
          `offset=${formatSeconds(offset)}[${outputName}]`
      );

      lastOutput = outputName;
      accumulatedDuration += clipDuration - transitionDuration;
    }

    // Gentle opening and closing fades make the finished reel feel intentional.
    const fadeInDuration = Math.min(0.35, totalSeconds * 0.04);
    const fadeOutDuration = Math.min(0.45, totalSeconds * 0.05);
    const fadeOutStart = Math.max(0, totalSeconds - fadeOutDuration);

    filters.push(
      `[${lastOutput}]` +
        `fade=t=in:st=0:d=${formatSeconds(fadeInDuration)},` +
        `fade=t=out:st=${formatSeconds(fadeOutStart)}:d=${formatSeconds(fadeOutDuration)},` +
        `format=yuv420p[finalv]`
    );

    filesToClean.push(OUTPUT_FILE);

    command.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[finalv]",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      "-t",
      formatSeconds(totalSeconds),
      "-threads",
      "1",
      "-movflags",
      "+faststart",
      OUTPUT_FILE
    );

    onProgress?.(
      "Rendering 5-keyframe camera animation, scene-matched transitions and cinematic finishing..."
    );

    const exitCode = await ffmpeg.exec(command);
    if (exitCode !== 0) {
      throw new Error(`Video rendering failed (FFmpeg exit code ${exitCode}). Please retry the export.`);
    }

    onProgress?.("Finalizing high-quality silent MP4...");

    const data = await ffmpeg.readFile(OUTPUT_FILE);
    if (!data || data.length < 1024) {
      throw new Error("The MP4 export is empty or incomplete. Please retry.");
    }

    return new Blob([data], { type: "video/mp4" });
  } catch (error) {
    const message = error?.message || "Unexpected video export error.";
    throw new Error(message);
  } finally {
    if (ffmpeg) {
      for (const fileName of filesToClean) {
        try {
          await ffmpeg.deleteFile(fileName);
        } catch {
          // Ignore cleanup errors from files that were not created.
        }
      }
    }

    exportInProgress = false;
  }
}
