const questions = [
  {
    question: "What does a data center actually do?",
    answer: "It houses networked computers that process and store information. These facilities support services such as websites, cloud applications, and AI. Power, cooling, and networking keep the equipment working.",
    source: "U.S. Energy Information Administration",
    url: "https://www.eia.gov/todayinenergy/detail.php?id=28232",
    layer: "data-centers",
  },
  {
    question: "Why does it need so much electricity?",
    answer: "Computers need power to perform their work, and cooling systems remove the heat they produce. Demand varies with the facility’s size, equipment, workload, and efficiency—not every data center has the same footprint.",
    source: "U.S. Department of Energy",
    url: "https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers",
    layer: "energy-infrastructure",
  },
  {
    question: "Does every data center use water for cooling?",
    answer: "Cooling designs differ. Some consume water through evaporation; others use air-based heat rejection or different systems. Water circulating in a closed loop is not the same as water consumed. Electricity generation can also have a water footprint, so local design and power sources matter.",
    source: "Department of Energy: water and cooling",
    url: "https://www.energy.gov/cmei/femp/cooling-water-efficiency-opportunities-federal-data-centers",
    layer: "data-centers",
  },
  {
    question: "What does a community gain—and give up?",
    answer: "Projects can bring construction work, ongoing jobs, and tax revenue. Residents may also face concerns about noise, land use, and demands on utilities. Ask for project-specific figures: permanent versus construction jobs, tax incentives, water needs, and who pays for infrastructure upgrades.",
    source: "Associated Press: community benefits and concerns",
    url: "https://apnews.com/article/0f148f7d22c0ed054c18090adbbd233d",
    layer: "energy-infrastructure",
  },
  {
    question: "Which companies are connected to the buildout?",
    answer: "Outfox’s map groups companies across power, chips, networks, software, and other parts of the AI economy. It is a research starting point—not a list of suppliers to every project or a promise that every company benefits equally.",
    source: "Outfox methodology and data sources",
    url: "/methodology",
    layer: "processors",
  },
];

export default function BuildoutQuestions() {
  return (
    <section aria-labelledby="buildout-questions-heading" className="mt-6 overflow-hidden rounded-xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="p-5" style={{ backgroundColor: "var(--accent-soft)" }}>
        <div className="kicker mb-2">Beyond the headlines</div>
        <h2 id="buildout-questions-heading" className="text-xl font-bold" style={{ color: "var(--text)" }}>Understand the buildout</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>Big questions. Plain-English answers.</p>
      </div>
      <div className="px-5">
        {questions.map((item, index) => (
          <details key={item.question} open={index === 0} className="group border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
            <summary className="cursor-pointer py-4 pr-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" style={{ color: "var(--text)" }}>{item.question}</summary>
            <div className="pb-5 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
              <p>{item.answer}</p>
              <a href={item.url} className="mt-3 block text-xs underline underline-offset-4">Source: {item.source}</a>
              <a href={`/layer/${item.layer}`} className="mt-3 inline-block font-semibold underline underline-offset-4" style={{ color: "var(--accent)" }}>Explore this layer →</a>
            </div>
          </details>
        ))}
      </div>
      <p className="px-5 pb-4 text-xs" style={{ color: "var(--text-dim)" }}>General explanations; local projects differ. Reviewed September 3, 2026.</p>
    </section>
  );
}
