export default function CvPanel({ profile }) {
  if (!profile) return null;
  const skills = Object.entries(profile.skills || {});

  return (
    <aside className="cv-panel panel">
      <div className="cv-header">
        <div className="avatar">AT</div>
        <div>
          <h2 id="cv-name">{profile.fullName}</h2>
          <p className="cv-role">{profile.headline || profile.title}</p>
          <p className="cv-loc">📍 {profile.location || ''}</p>
        </div>
      </div>
      <div className="cv-section">
        <h3>Sobre mí</h3>
        <p className="cv-summary">{profile.summary || ''}</p>
      </div>
      <div className="cv-section">
        <h3>Skills clave (peso)</h3>
        <div className="skill-tags">
          {skills.map(([k, v]) => (
            <span className="tag" key={k}>{k} ({(v * 100) | 0}%)</span>
          ))}
        </div>
      </div>
      <div className="cv-section">
        <h3>Enlaces</h3>
        <div className="links">
          <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://avtovar.github.io/Curriculum-Vitae/Ali_Tovar_CV.pdf" target="_blank" rel="noopener noreferrer">Ver CV PDF</a>
        </div>
      </div>
    </aside>
  );
}
