
import { useState } from "react";
import {
  ImagePlus,
  Sparkles,
  Film,
  Settings,
  FolderOpen,
  LayoutTemplate,
  RotateCcw,
  Upload,
  Download,
  Image as ImageIcon,
  Music2,
  Clock3,
  WandSparkles,
} from "lucide-react";

const styles = ["Devotional", "Serene", "Energetic", "Minimal"];
const durations = ["15 Sec", "30 Sec", "60 Sec"];

export default function App() {
  const [activeTab, setActiveTab] = useState("Studio");
  const [style, setStyle] = useState("Devotional");
  const [duration, setDuration] = useState("30 Sec");
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState([null, null, null, null]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [status, setStatus] = useState("Ready to create");
  const [busy, setBusy] = useState(false);

  function handleReference(index, file) {
    if (!file) return;
    setReferences((current) =>
      current.map((item, i) => (i === index ? file : item))
    );
  }

  function resetStudio() {
    setStyle("Devotional");
    setDuration("30 Sec");
    setPrompt("");
    setGeneratedImages([]);
    setStatus("Ready to create");
  }

  function startAction(action) {
    setStatus(
      `${action} requires the Cloudflare Worker backend. Backend setup is next.`
    );
  }

  const navItems = [
    { name: "Studio", icon: Sparkles },
    { name: "Projects", icon: FolderOpen },
    { name: "Templates", icon: LayoutTemplate },
    { name: "Settings", icon: Settings },
  ];

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
              Create beautiful devotional image-based reels. Crafted for
              devotion.
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
                  <p>Your vertical devotional reel preview</p>
                </div>
                <span className="live-dot">READY</span>
              </div>

              <div className="preview-stage">
                <div className="phone-frame">
                  {generatedImages.length > 0 ? (
                    <img
                      src={generatedImages[0]}
                      alt="Generated devotional preview"
                    />
                  ) : (
                    <div className="preview-placeholder">
                      <div className="placeholder-icon">
                        <ImageIcon size={30} />
                      </div>
                      <h3>Your divine creation</h3>
                      <p>
                        Your generated devotional images will appear here.
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
            </section>

            <section className="panel controls-panel">
              <div className="panel-heading">
                <div>
                  <h2>Reel Settings</h2>
                  <p>Customize your devotional creation</p>
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
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label>YOUR CREATIVE PROMPT</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe your devotional image concept..."
                  rows={4}
                />
              </div>

              <div className="control-group">
                <div className="reference-heading">
                  <label>STYLE REFERENCE IMAGES</label>
                  <span>4 SLOTS</span>
                </div>
                <p className="field-help">
                  Upload or replace references anytime. Active references guide
                  the visual style of new images.
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
                        accept="image/*"
                        onChange={(event) =>
                          handleReference(index, event.target.files?.[0])
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => startAction("Auto Edit")}
                >
                  <Sparkles size={17} />
                  Auto Edit
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => startAction("Auto Draft")}
                >
                  <Film size={17} />
                  Auto Draft
                </button>
              </div>

              <button className="reset-button" onClick={resetStudio}>
                <RotateCcw size={15} />
                Reset Settings
              </button>
            </section>
          </div>
        ) : (
          <section className="panel empty-section">
            <FolderOpen size={32} />
            <h2>{activeTab}</h2>
            <p>This section will be connected during the next development steps.</p>
          </section>
        )}
      </main>

      <footer className="footer">
        <div>
          <strong>Rudra Bhakti</strong>
          <span> · Reel Studio</span>
        </div>
        <div>IMAGE-BASED DEVOTIONAL REELS · SILENT MP4 EXPORT</div>
      </footer>
    </div>
  );
}
