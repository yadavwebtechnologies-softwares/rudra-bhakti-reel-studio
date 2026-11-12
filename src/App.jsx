
import { useEffect, useState } from "react";
import {
  ImagePlus,
  Sparkles,
  Film,
  Settings,
  FolderOpen,
  LayoutTemplate,
  RotateCcw,
  Image as ImageIcon,
  Music2,
  Clock3,
  WandSparkles,
  Download,
  CheckCircle2,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import {
  checkBackend,
  planStory,
  generateSceneImage,
  fileToDataUrl,
} from "./api.js";

const styles = ["Devotional", "Serene", "Energetic", "Minimal"];
const durations = ["15 Sec", "30 Sec", "60 Sec"];

function getSceneCount(duration) {
  if (duration === "15 Sec") return 3;
  if (duration === "60 Sec") return 8;
  return 5;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Studio");
  const [style, setStyle] = useState("Devotional");
  const [duration, setDuration] = useState("30 Sec");
  const [prompt, setPrompt] = useState("");

  const [references, setReferences] = useState([
    null,
    null,
    null,
    null,
  ]);

  const [storyboard, setStoryboard] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedScene, setSelectedScene] = useState(0);

  const [status, setStatus] = useState("Checking backend connection...");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    checkBackend()
      .then(() => {
        if (!active) return;
        setBackendStatus("online");
        setStatus("Ready to create");
      })
      .catch((err) => {
        if (!active) return;
        setBackendStatus("offline");
        setStatus("Backend connection unavailable");
        setError(err.message || "Could not connect to the AI backend.");
      });

    return () => {
      active = false;
    };
  }, []);

  function handleReference(index, file) {
    if (!file) return;

    setReferences((current) =>
      current.map((item, i) => (i === index ? file : item))
    );

    setError("");
  }

  function resetStudio() {
    if (busy) return;

    setStyle("Devotional");
    setDuration("30 Sec");
    setPrompt("");
    setReferences([null, null, null, null]);
    setStoryboard(null);
    setGeneratedImages([]);
    setSelectedScene(0);
    setProgress("");
    setError("");
    setStatus("Ready to create");
  }

  async function createStoryboard() {
    const story = prompt.trim();

    if (story.length < 10) {
      throw new Error("Please enter a story with at least 10 characters.");
    }

    const sceneCount = getSceneCount(duration);

    setStatus("AI is planning your story...");
    setProgress("Creating your storyboard...");
    setError("");

    const result = await planStory(
      `${story}\n\nVisual mood: ${style}. Keep the same characters, faces, clothing and identity throughout all scenes.`,
      sceneCount
    );

    if (!result.scenes || result.scenes.length === 0) {
      throw new Error("AI did not return any scenes.");
    }

    setStoryboard(result);
    setGeneratedImages([]);
    setSelectedScene(0);

    setStatus(`${result.scenes.length} scenes planned successfully`);
    setProgress(`${result.scenes.length} scenes ready`);
    return result;
  }

  async function handleAutoDraft() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await createStoryboard();
    } catch (err) {
      setError(err.message || "Could not create the storyboard.");
      setStatus("Storyboard creation failed");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoEdit() {
    if (busy) return;

    if (backendStatus !== "online") {
      setError("AI backend is not connected. Please check your Worker.");
      return;
    }

    setBusy(true);
    setError("");
    setGeneratedImages([]);

    try {
      const plan = await createStoryboard();

      setStatus("Preparing reference images...");
      setProgress("Reading your active style references...");

      const activeReferences = (
        await Promise.all(
          references
            .filter(Boolean)
            .map((file) => fileToDataUrl(file))
        )
      );

      const results = [];

      for (let i = 0; i < plan.scenes.length; i++) {
        const scene = plan.scenes[i];

        setStatus(`Generating scene ${i + 1} of ${plan.scenes.length}...`);
        setProgress(
          `Creating image ${i + 1}/${plan.scenes.length}: ${scene.sceneTitle}`
        );

        const result = await generateSceneImage({
          scenePrompt: `${scene.imagePrompt}\n\nVisual mood: ${style}.`,
          characterBible: plan.characterBible,
          references: activeReferences,
        });

        if (!result.imageDataUrl) {
          throw new Error(`Image generation failed for scene ${i + 1}.`);
        }

        results.push({
          ...scene,
          imageDataUrl: result.imageDataUrl,
        });

        setGeneratedImages([...results]);
        setSelectedScene(0);
      }

      setStatus("All scene images generated successfully!");
      setProgress(`${results.length} of ${results.length} scenes completed`);
    } catch (err) {
      setError(err.message || "Image generation failed.");
      setStatus("Generation stopped");
      setProgress("Some scenes may have been generated successfully.");
    } finally {
      setBusy(false);
    }
  }

  function downloadScene(scene, index) {
    if (!scene?.imageDataUrl) return;

    const link = document.createElement("a");
    link.href = scene.imageDataUrl;
    link.download = `rudra-bhakti-scene-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const navItems = [
    { name: "Studio", icon: Sparkles },
    { name: "Projects", icon: FolderOpen },
    { name: "Templates", icon: LayoutTemplate },
    { name: "Settings", icon: Settings },
  ];

  const currentScene = generatedImages[selectedScene];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#studio">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>
          <div>
            <div className="brand-name">Rudra Bhakti</div>
            <div className="brand-caption">
              REEL STUDIO · AUTO EDIT · AUTO DRAFT
            </div>
          </div>
        </a>

        <nav className="navigation">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-link ${activeTab === name ? "active" : ""}`}
              onClick={() => setActiveTab(name)}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content" id="studio">
        <section className="page-heading">
          <div>
            <div className="eyebrow">YOUR DEVOTIONAL CREATION SPACE</div>
            <h1>Create your next Reel</h1>
            <p>
              Turn your story into beautiful, consistent devotional
              image scenes.
            </p>
          </div>
          <div className="version-tag">BETA · VERSION 1.0</div>
        </section>

        {activeTab === "Studio" ? (
          <div className="studio-grid">
            <section className="panel preview-panel">
              <div className="panel-heading">
                <div>
                  <h2>Live Preview</h2>
                  <p>
                    {generatedImages.length > 0
                      ? `Scene ${selectedScene + 1} of ${generatedImages.length}`
                      : "Your vertical devotional scene preview"}
                  </p>
                </div>

                <span
                  className={`live-dot ${
                    backendStatus === "offline" ? "offline" : ""
                  }`}
                >
                  {backendStatus === "online"
                    ? "AI ONLINE"
                    : backendStatus === "offline"
                      ? "OFFLINE"
                      : "CONNECTING"}
                </span>
              </div>

              <div className="preview-stage">
                <div className="phone-frame">
                  {currentScene ? (
                    <img
                      src={currentScene.imageDataUrl}
                      alt={currentScene.sceneTitle}
                    />
                  ) : (
                    <div className="preview-placeholder">
                      <div className="placeholder-icon">
                        {busy ? (
                          <LoaderCircle size={30} />
                        ) : (
                          <ImageIcon size={30} />
                        )}
                      </div>
                      <h3>Your divine creation</h3>
                      <p>
                        {busy
                          ? "Your scene is being created..."
                          : "Your generated devotional images will appear here."}
                      </p>
                      <span>9:16 VERTICAL FORMAT</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="preview-status">
                <span className="status-indicator" />
                <span>{status}</span>
              </div>

              {progress && (
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  {progress}
                </p>
              )}

              <div className="preview-info">
                <div>
                  <Clock3 size={15} />
                  {duration}
                </div>
                <div>
                  <Music2 size={15} />
                  Silent export · Add Facebook music later
                </div>
              </div>

              {generatedImages.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 12 }}>
                    Generated Scenes
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {generatedImages.map((scene, index) => (
                      <button
                        key={scene.sceneNumber}
                        onClick={() => setSelectedScene(index)}
                        style={{
                          border:
                            selectedScene === index
                              ? "2px solid #7c5cff"
                              : "1px solid #ddd",
                          borderRadius: 8,
                          padding: 3,
                          background: "white",
                          cursor: "pointer",
                        }}
                        title={scene.sceneTitle}
                      >
                        <img
                          src={scene.imageDataUrl}
                          alt={scene.sceneTitle}
                          style={{
                            width: "100%",
                            aspectRatio: "9 / 16",
                            objectFit: "cover",
                            borderRadius: 5,
                            display: "block",
                          }}
                        />
                        <span style={{ fontSize: 11 }}>
                          Scene {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>

                  {currentScene && (
                    <div style={{ marginTop: 14 }}>
                      <h3 style={{ fontSize: 14 }}>
                        {currentScene.sceneTitle}
                      </h3>
                      <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                        {currentScene.sceneDescription}
                      </p>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          downloadScene(currentScene, selectedScene)
                        }
                        style={{ marginTop: 10 }}
                      >
                        <Download size={16} />
                        Download This Scene
                      </button>
                    </div>
                  )}
                </div>
              )}

              {storyboard && (
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontSize: 14 }}>Story: {storyboard.title}</h3>
                  <p style={{ fontSize: 12, lineHeight: 1.5 }}>
                    Character identity is shared across the planned scenes.
                  </p>
                </div>
              )}
            </section>

            <section className="panel controls-panel">
              <div className="panel-heading">
                <div>
                  <h2>Reel Settings</h2>
                  <p>Turn your story into visual scenes</p>
                </div>
                <WandSparkles size={20} />
              </div>

              <div className="control-group">
                <label>VISUAL MOOD</label>
                <div className="chip-row">
                  {styles.map((item) => (
                    <button
                      key={item}
                      className={`choice-chip ${
                        style === item ? "selected" : ""
                      }`}
                      onClick={() => setStyle(item)}
                      disabled={busy}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label>REEL DURATION</label>
                <div className="chip-row">
                  {durations.map((item) => (
                    <button
                      key={item}
                      className={`choice-chip ${
                        duration === item ? "selected" : ""
                      }`}
                      onClick={() => setDuration(item)}
                      disabled={busy}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="field-help">
                  {getSceneCount(duration)} visual scenes will be planned.
                </p>
              </div>

              <div className="control-group">
                <label>YOUR STORY / CREATIVE PROMPT</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Apni Hindi kahani yahan likhein... Example: Bhagwan Shiva aur Mata Parvati Kailash par ek divya pal saath bita rahe hain..."
                  rows={6}
                  disabled={busy}
                />
                <p className="field-help">
                  AI will divide your story into different moments. No
                  narration or voiceover will be generated.
                </p>
              </div>

              <div className="control-group">
                <div className="reference-heading">
                  <label>STYLE REFERENCE IMAGES</label>
                  <span>4 SLOTS</span>
                </div>
                <p className="field-help">
                  Upload or replace references anytime. Active references
                  guide the visual style, lighting, colours and quality
                  of new images.
                </p>

                <div className="reference-grid">
                  {references.map((file, index) => (
                    <label className="reference-slot" key={index}>
                      {file ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Reference ${index + 1}`}
                        />
                      ) : (
                        <>
                          <ImagePlus size={21} />
                          <span>Reference {index + 1}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={(event) => {
                          handleReference(
                            index,
                            event.target.files?.[0]
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 8,
                    background: "#fff0ef",
                    color: "#b42318",
                    fontSize: 13,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}

              <div className="action-buttons">
                <button
                  className="primary-button"
                  disabled={busy || backendStatus !== "online"}
                  onClick={handleAutoEdit}
                >
                  {busy ? (
                    <LoaderCircle size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {busy ? "Creating..." : "Auto Edit"}
                </button>

                <button
                  className="secondary-button"
                  disabled={busy || backendStatus !== "online"}
                  onClick={handleAutoDraft}
                >
                  <Film size={17} />
                  Auto Draft
                </button>
              </div>

              <button
                className="reset-button"
                onClick={resetStudio}
                disabled={busy}
              >
                <RotateCcw size={15} />
                Reset Settings
              </button>

              {storyboard && (
                <div style={{ marginTop: 18, fontSize: 12 }}>
                  <CheckCircle2 size={15} />
                  {" "}Storyboard available · {storyboard.scenes.length} scenes
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="panel empty-section">
            <FolderOpen size={32} />
            <h2>{activeTab}</h2>
            <p>
              This section will be connected during the next development
              steps.
            </p>
          </section>
        )}
      </main>

      <footer className="footer">
        <div>
          <strong>Rudra Bhakti</strong>
          <span> · Reel Studio</span>
        </div>
        <div>
          IMAGE-BASED DEVOTIONAL REELS · SILENT MP4 EXPORT
        </div>
      </footer>
    </div>
  );
}
