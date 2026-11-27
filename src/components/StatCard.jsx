
function StatCard({ title, value, description, icon: Icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-title">{title}</span>

        <div
          className="stat-icon"
          style={{
            backgroundColor: `${color}15`,
            color: color
          }}
        >
          <Icon size={22} />
        </div>
      </div>

      <h2 className="stat-value">{value}</h2>

      <p className="stat-description">
        {description}
      </p>
    </div>
  )
}

export default StatCard
