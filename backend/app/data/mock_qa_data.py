"""
Authoritative Q&A data and re-rating history for each policy.
This is the source of truth -- the LLM analyzes this data, never invents it.
"""

POLICY_REASONS: dict[str, list[dict]] = {
    # --- REFERRAL POLICIES ---
    "25PL00012345": [
        {"question": "What is the insured's annual revenue?", "answer": "$500M", "severity": "high", "flag": "Exceeds $100M authority threshold for Professional Liability"},
        {"question": "How many prior claims in the last 5 years?", "answer": "3 claims totaling $2.1M", "severity": "high", "flag": "Exceeds 2-claim threshold for referral"},
        {"question": "What is the insured's primary service?", "answer": "Management consulting for Fortune 500 companies", "severity": "medium", "flag": "High-profile client base increases exposure"},
        {"question": "Does the insured have existing risk management procedures?", "answer": "Yes, ISO 27001 certified", "severity": "low", "flag": "Positive factor but insufficient to offset revenue and claims"},
    ],
    "25DO00023456": [
        {"question": "What is the company's market capitalization?", "answer": "$4.2B", "severity": "high", "flag": "Exceeds $1B market cap threshold requiring senior UW approval"},
        {"question": "Are there any pending SEC investigations?", "answer": "One informal inquiry regarding Q3 disclosures", "severity": "high", "flag": "Active regulatory scrutiny triggers mandatory referral"},
        {"question": "What is the board composition?", "answer": "9 members, 4 independent", "severity": "medium", "flag": "Less than 50% independent directors for a public company"},
        {"question": "Has the company restated financials in the last 3 years?", "answer": "Yes, minor restatement in 2024 for lease accounting", "severity": "medium", "flag": "Any financial restatement triggers referral flag"},
    ],
    "25CY00045678": [
        {"question": "What volume of PII records does the insured store?", "answer": "45 million customer records", "severity": "high", "flag": "Exceeds 10M records threshold for cyber referral"},
        {"question": "Has the insured experienced a data breach in the last 3 years?", "answer": "Yes, phishing incident in 2024 affecting 12,000 records", "severity": "high", "flag": "Prior breach within 3 years is automatic referral"},
        {"question": "What is the insured's cybersecurity maturity rating?", "answer": "NIST CSF Tier 2 (Risk Informed)", "severity": "medium", "flag": "Below Tier 3 recommended for this data volume"},
        {"question": "Does the insured have MFA enabled for all remote access?", "answer": "MFA on VPN only, not on all cloud applications", "severity": "medium", "flag": "Partial MFA coverage is a gap for cloud-heavy operations"},
        {"question": "What is the annual IT security budget?", "answer": "$3.2M (0.8% of revenue)", "severity": "medium", "flag": "Below 1% of revenue benchmark for technology companies"},
    ],
    "25EO00034567": [
        {"question": "What is the largest single project value?", "answer": "$85M mixed-use development", "severity": "high", "flag": "Single project exceeds 50% of annual revenue -- concentration risk"},
        {"question": "Are there any active professional liability claims?", "answer": "One pending claim for $1.2M related to structural design error", "severity": "high", "flag": "Active claim during policy period requires referral"},
        {"question": "What percentage of work involves government contracts?", "answer": "35%", "severity": "medium", "flag": "Government contract work above 25% triggers additional review"},
    ],
    "26MC00056789": [
        {"question": "What is the primary cargo type?", "answer": "Lithium-ion batteries and electronic components", "severity": "high", "flag": "Hazardous cargo classification -- lithium batteries require specialist review"},
        {"question": "What shipping routes are used?", "answer": "Trans-Pacific (Shanghai to Long Beach) and South China Sea", "severity": "high", "flag": "South China Sea route has elevated piracy and geopolitical risk"},
        {"question": "What is the average shipment value?", "answer": "$12M per container vessel", "severity": "medium", "flag": "Per-shipment value exceeds $10M single-transit limit"},
        {"question": "Does the insured use approved vessel classifications?", "answer": "Mostly Lloyd's A1 rated, some chartered vessels unrated", "severity": "medium", "flag": "Unrated chartered vessels introduce hull risk uncertainty"},
    ],
    "25EL00067890": [
        {"question": "What type of environmental operations does the insured conduct?", "answer": "Chemical manufacturing with on-site waste treatment", "severity": "high", "flag": "On-site chemical waste treatment is high environmental risk category"},
        {"question": "Have there been any EPA violations in the last 5 years?", "answer": "Two Notice of Violations (NOVs) in 2023 for wastewater discharge", "severity": "high", "flag": "Multiple EPA violations within 5 years is automatic referral"},
        {"question": "Is the facility located near any protected waterways?", "answer": "Within 2 miles of Cedar Creek watershed", "severity": "high", "flag": "Proximity to protected watershed increases regulatory and remediation exposure"},
        {"question": "What remediation reserves does the insured hold?", "answer": "$8M allocated", "severity": "medium", "flag": "Reserves below estimated $15M full remediation cost"},
    ],
    "26AV00078901": [
        {"question": "What aircraft types are in the fleet?", "answer": "12 Boeing 737-800s, 4 Airbus A320neos", "severity": "high", "flag": "Mixed fleet with 16 aircraft exceeds 10-aircraft threshold for referral"},
        {"question": "What is the fleet's average age?", "answer": "14 years (range: 8-22 years)", "severity": "high", "flag": "Aircraft over 20 years old in fleet require specialist inspection verification"},
        {"question": "What are the primary operational routes?", "answer": "Domestic US and Caribbean island-hopping routes", "severity": "medium", "flag": "Caribbean routes have higher weather-related incident frequency"},
        {"question": "What is the pilot retention rate?", "answer": "72% over last 2 years", "severity": "medium", "flag": "Below 80% pilot retention threshold indicates crew experience risk"},
    ],
    "25XS00089012": [
        {"question": "What is the underlying primary limit?", "answer": "$5M occurrence, $10M aggregate", "severity": "high", "flag": "Excess layer attaches at $5M which is below preferred $10M attachment for this class"},
        {"question": "What industry does the insured operate in?", "answer": "Heavy industrial manufacturing -- forging and metal stamping", "severity": "medium", "flag": "Heavy industrial class carries elevated bodily injury exposure"},
        {"question": "What is the insured's Experience Modification Rate?", "answer": "1.35", "severity": "high", "flag": "EMR above 1.25 triggers excess liability referral"},
    ],
    "26PL00090123": [
        {"question": "What type of professional services?", "answer": "Immigration law with 200+ active client matters", "severity": "high", "flag": "Immigration law has elevated malpractice frequency -- volume exceeds 150-matter threshold"},
        {"question": "What is the firm's claims history?", "answer": "Zero claims in 8 years of practice", "severity": "low", "flag": "Clean history is positive but volume risk still requires review"},
        {"question": "Does the firm handle asylum cases?", "answer": "Yes, approximately 30% of caseload", "severity": "medium", "flag": "Asylum cases carry higher emotional distress claim potential"},
    ],
    "25DO00101234": [
        {"question": "Is the company pre-revenue or early-stage?", "answer": "Pre-revenue, Phase III clinical trials", "severity": "high", "flag": "Pre-revenue biotech with clinical trials is highest D&O risk tier"},
        {"question": "What is the cash runway?", "answer": "18 months at current burn rate", "severity": "high", "flag": "Sub-24-month runway creates securities litigation risk if trials fail"},
        {"question": "Has the company completed an IPO or SPAC?", "answer": "IPO completed Q2 2025, raised $340M", "severity": "high", "flag": "Recent IPO within 12 months triggers heightened securities class action exposure"},
        {"question": "What is the current stock price vs IPO price?", "answer": "Trading at $14 vs $22 IPO price (36% decline)", "severity": "high", "flag": "Significant post-IPO stock decline is primary D&O securities suit trigger"},
    ],
    "26CY00112345": [
        {"question": "What is the insured's primary business model?", "answer": "Cloud-based SaaS platform for healthcare data", "severity": "high", "flag": "Healthcare data SaaS handles PHI -- HIPAA exposure requires referral"},
        {"question": "Is the insured HIPAA compliant?", "answer": "SOC 2 Type II certified, HIPAA compliance in progress", "severity": "high", "flag": "HIPAA compliance not yet achieved while handling PHI is a gap"},
        {"question": "What is the annual recurring revenue?", "answer": "$45M ARR with 400+ healthcare clients", "severity": "medium", "flag": "Scale of healthcare client base amplifies breach notification costs"},
    ],
    "25EO00123456": [
        {"question": "What is the insured's largest client concentration?", "answer": "Top client represents 40% of revenue", "severity": "high", "flag": "Single client above 30% revenue is concentration risk for E&O"},
        {"question": "Has the insured faced any professional negligence claims?", "answer": "One settled claim for $450K in 2023 (design flaw in bridge expansion joint)", "severity": "high", "flag": "Infrastructure design claim indicates systemic QA concern"},
        {"question": "What QA/QC processes are in place?", "answer": "ISO 9001 certified with independent peer review on projects over $5M", "severity": "low", "flag": "Strong QA but does not cover projects under $5M threshold"},
    ],

    # --- DECLINE POLICIES ---
    "25CY00134567": [
        {"question": "What is the insured's primary business?", "answer": "Cryptocurrency exchange and DeFi lending platform", "severity": "high", "flag": "Cryptocurrency exchanges are on the excluded industries list"},
        {"question": "Has the insured experienced any security incidents?", "answer": "Hot wallet compromise in 2024 resulting in $18M customer fund loss", "severity": "high", "flag": "Material security incident with customer fund loss -- uninsurable risk profile"},
        {"question": "What regulatory licenses does the insured hold?", "answer": "Money transmitter license in 12 states, no federal charter", "severity": "high", "flag": "Fragmented regulatory status increases enforcement action risk"},
        {"question": "What is the insured's crypto custody solution?", "answer": "70% hot wallet, 30% cold storage", "severity": "high", "flag": "Hot wallet ratio above 50% is outside acceptable risk parameters"},
    ],
    "25EL00145678": [
        {"question": "What hazardous materials does the insured handle?", "answer": "PCBs, asbestos-containing materials, and radioactive waste (low-level)", "severity": "high", "flag": "Radioactive waste handling is outside environmental liability appetite"},
        {"question": "What is the insured's EPA compliance status?", "answer": "Currently under EPA Consent Decree for RCRA violations", "severity": "high", "flag": "Active Consent Decree is automatic decline trigger"},
        {"question": "How many active remediation sites?", "answer": "7 sites, 3 on EPA National Priorities List", "severity": "high", "flag": "NPL-listed sites represent unlimited remediation liability exposure"},
    ],
    "25DO00156789": [
        {"question": "Is the company currently under investigation?", "answer": "DOJ and SEC parallel investigations for accounting fraud", "severity": "high", "flag": "Active DOJ/SEC parallel investigation is automatic decline"},
        {"question": "Have any officers been personally named in litigation?", "answer": "CEO and CFO named in shareholder derivative suit", "severity": "high", "flag": "Named officer litigation represents known existing liability"},
        {"question": "What is the company's debt-to-equity ratio?", "answer": "4.8:1", "severity": "high", "flag": "Debt ratio above 3:1 indicates severe financial distress -- insolvency risk"},
        {"question": "Has the auditor issued a going concern opinion?", "answer": "Yes, in the most recent annual report", "severity": "high", "flag": "Going concern opinion confirms insolvency risk -- unable to underwrite"},
    ],
    "25AV00167890": [
        {"question": "What is the aircraft maintenance regime?", "answer": "Maintained to FAA minimums, no enhanced inspection program", "severity": "high", "flag": "FAA-minimum-only maintenance is below underwriting standards for commercial fleet"},
        {"question": "What is the fleet accident history?", "answer": "2 hull losses and 1 fatal incident in last 5 years", "severity": "high", "flag": "Fatal incident history makes risk unplaceable in standard market"},
        {"question": "Where are maintenance facilities located?", "answer": "Primary MRO in country with non-ICAO-compliant oversight", "severity": "high", "flag": "Non-ICAO-compliant maintenance jurisdiction is outside appetite"},
    ],
    "26PL00178901": [
        {"question": "What is the firm's disciplinary history?", "answer": "Lead partner suspended for 6 months in 2024 by state bar", "severity": "high", "flag": "Recent disciplinary action against lead partner is automatic decline trigger"},
        {"question": "What is the nature of the suspension?", "answer": "Commingling of client trust funds", "severity": "high", "flag": "Trust fund violations indicate systemic ethical concerns"},
        {"question": "What percentage of revenue comes from the suspended partner?", "answer": "65%", "severity": "high", "flag": "Key-person dependency on disciplined attorney -- uninsurable concentration"},
    ],
    "25MC00189012": [
        {"question": "What cargo is being transported?", "answer": "Crude oil via single-hull tankers", "severity": "high", "flag": "Single-hull tankers are prohibited under IMO regulations for oil transport"},
        {"question": "What flag states are the vessels registered under?", "answer": "Flag of convenience states with poor PSC detention records", "severity": "high", "flag": "Substandard flag states are outside marine cargo underwriting appetite"},
        {"question": "Does the insured transport through sanctioned waters?", "answer": "Routes include waters adjacent to sanctioned territories", "severity": "high", "flag": "Sanctions exposure creates compliance and claims coverage conflict"},
    ],
    "25XS00190123": [
        {"question": "What type of demolition work?", "answer": "Explosive demolition of commercial and industrial structures", "severity": "high", "flag": "Explosive demolition is classified as excluded activity for excess liability"},
        {"question": "What is the insured's safety record?", "answer": "2 OSHA citations in past 12 months, one Serious classification", "severity": "high", "flag": "Serious OSHA citation within 12 months is automatic decline"},
        {"question": "Does the insured carry adequate primary coverage?", "answer": "Primary limit of $1M occurrence -- seeking $25M excess", "severity": "high", "flag": "25:1 excess-to-primary ratio is outside acceptable parameters"},
    ],
    "26EO00201234": [
        {"question": "What types of construction projects?", "answer": "Fast-track residential developments with compressed timelines", "severity": "high", "flag": "Fast-track construction has 3x the defect claim frequency of standard builds"},
        {"question": "What is the defect claim history?", "answer": "4 claims in last 3 years totaling $3.8M for water intrusion and structural defects", "severity": "high", "flag": "Pattern of repeat defect claims indicates systemic quality failure"},
        {"question": "What is the loss ratio for the expiring policy?", "answer": "185%", "severity": "high", "flag": "Loss ratio above 100% makes renewal unviable -- declining"},
    ],
    "25CY00212345": [
        {"question": "What industry does the insured operate in?", "answer": "Online gambling and real-money gaming platform", "severity": "high", "flag": "Online gambling is on the excluded industries list for cyber liability"},
        {"question": "What is the insured's regulatory status?", "answer": "Licensed in 3 US states, operating in 8 additional states pending licensing", "severity": "high", "flag": "Operating in unlicensed jurisdictions creates regulatory action exposure"},
        {"question": "What payment processing methods are used?", "answer": "Cryptocurrency deposits accepted alongside traditional methods", "severity": "high", "flag": "Cryptocurrency payment acceptance adds AML/KYC compliance risk layer"},
    ],
    "26DO00223456": [
        {"question": "Is the company facing any product liability litigation?", "answer": "Multi-district litigation (MDL) involving 2,300 plaintiffs for adverse drug reactions", "severity": "high", "flag": "Active MDL with 2,300+ plaintiffs is catastrophic exposure -- automatic decline"},
        {"question": "What is the estimated litigation liability?", "answer": "Company disclosed $800M-$1.5B potential liability range", "severity": "high", "flag": "Billion-dollar litigation exposure far exceeds any D&O program capacity"},
        {"question": "Has the company's stock declined related to this litigation?", "answer": "62% decline since MDL consolidation announcement", "severity": "high", "flag": "Severe stock decline plus active MDL guarantees securities class action follow-on"},
    ],
}


RERATING_HISTORY: dict[str, list[dict]] = {
    "25PL00012345": [
        {
            "rerate_number": 1,
            "date": "2025-07-20",
            "reason": "Broker provided updated financials showing revenue stabilized at $480M (previously estimated $550M)",
            "premium_before": 310000,
            "premium_after": 275000,
            "changes": ["Revenue factor adjusted from $550M to $480M", "Base rate reduced by 8%"],
        },
        {
            "rerate_number": 2,
            "date": "2025-08-15",
            "reason": "Insured agreed to $500K higher self-insured retention and implemented new client engagement protocols",
            "premium_before": 275000,
            "premium_after": 245000,
            "changes": ["SIR increased from $250K to $750K", "Risk improvement credit of 5% applied", "New engagement protocol acknowledged"],
        },
    ],
    "25CY00045678": [
        {
            "rerate_number": 1,
            "date": "2025-09-01",
            "reason": "Insured completed third-party penetration test and remediated critical findings",
            "premium_before": 450000,
            "premium_after": 420000,
            "changes": ["Penetration test credit of 5% applied", "Critical vulnerability remediation verified"],
        },
        {
            "rerate_number": 2,
            "date": "2025-10-10",
            "reason": "Broker negotiated sub-limit reduction on social engineering coverage from $5M to $2M",
            "premium_before": 420000,
            "premium_after": 395000,
            "changes": ["Social engineering sub-limit reduced to $2M", "Premium credit for reduced aggregation risk"],
        },
        {
            "rerate_number": 3,
            "date": "2025-11-05",
            "reason": "Insured deployed MFA across all cloud applications and achieved NIST CSF Tier 3",
            "premium_before": 395000,
            "premium_after": 380000,
            "changes": ["Full MFA deployment credit applied", "NIST CSF upgraded from Tier 2 to Tier 3", "Residual premium reflects improved security posture"],
        },
    ],
    "25EO00034567": [
        {
            "rerate_number": 1,
            "date": "2025-10-01",
            "reason": "Pending claim settled for $800K (below $1.2M reserve) -- favorable development",
            "premium_before": 210000,
            "premium_after": 175000,
            "changes": ["Claim reserve released $400K favorable", "Experience rating improved", "Premium reduced 16.7%"],
        },
    ],
    "25EL00067890": [
        {
            "rerate_number": 1,
            "date": "2025-11-15",
            "reason": "Insured completed Phase I remediation at primary facility and received EPA acknowledgment",
            "premium_before": 480000,
            "premium_after": 445000,
            "changes": ["Phase I remediation completion credit", "EPA compliance status improved from 'violation' to 'corrective action'"],
        },
        {
            "rerate_number": 2,
            "date": "2025-12-20",
            "reason": "Insured installed upgraded wastewater monitoring system exceeding EPA requirements",
            "premium_before": 445000,
            "premium_after": 415000,
            "changes": ["Environmental monitoring enhancement credit", "Real-time discharge monitoring reduces incident response time"],
        },
    ],
    "25XS00089012": [
        {
            "rerate_number": 1,
            "date": "2025-12-10",
            "reason": "Insured improved safety program -- EMR projected to drop to 1.15 at next review",
            "premium_before": 230000,
            "premium_after": 195000,
            "changes": ["Prospective EMR improvement credit applied", "Safety investment plan documented and verified"],
        },
    ],
    "25DO00101234": [
        {
            "rerate_number": 1,
            "date": "2026-01-15",
            "reason": "Broker provided Phase III interim results showing positive efficacy data -- stock recovered 15%",
            "premium_before": 950000,
            "premium_after": 890000,
            "changes": ["Reduced securities litigation risk premium based on positive trial data", "Stock recovery narrows investor loss gap"],
        },
    ],
    "25EO00123456": [
        {
            "rerate_number": 1,
            "date": "2025-11-20",
            "reason": "Insured diversified client base -- top client now represents 32% of revenue (down from 40%)",
            "premium_before": 168000,
            "premium_after": 155000,
            "changes": ["Client concentration risk reduced", "Diversification credit of 7.7% applied"],
        },
        {
            "rerate_number": 2,
            "date": "2025-12-15",
            "reason": "Insured extended independent peer review to all projects (previously only projects over $5M)",
            "premium_before": 155000,
            "premium_after": 142000,
            "changes": ["QA/QC improvement credit", "Peer review now covers full project portfolio", "Residual risk reduced for smaller projects"],
        },
    ],
    "25DO00156789": [
        {
            "rerate_number": 1,
            "date": "2025-10-20",
            "reason": "Company engaged new legal counsel and proposed enhanced D&O insurance structure",
            "premium_before": 1200000,
            "premium_after": 1100000,
            "changes": ["Defense cost structure improved", "New counsel reputation credit"],
        },
        {
            "rerate_number": 2,
            "date": "2025-11-30",
            "reason": "Upon deeper review, DOJ investigation expanded -- decision to decline maintained despite re-rating attempts",
            "premium_before": 1100000,
            "premium_after": 0,
            "changes": ["DOJ investigation scope expanded", "Risk deemed uninsurable", "Policy declined"],
        },
    ],
    "26PL00178901": [
        {
            "rerate_number": 1,
            "date": "2026-02-01",
            "reason": "Firm proposed adding two additional partners to reduce key-person dependency",
            "premium_before": 320000,
            "premium_after": 0,
            "changes": ["Key-person risk partially mitigated but disciplinary history remains", "Decline decision upheld -- trust fund violation is absolute exclusion trigger"],
        },
    ],
    "26EO00201234": [
        {
            "rerate_number": 1,
            "date": "2026-02-28",
            "reason": "Insured proposed hiring independent QA inspector for all future projects",
            "premium_before": 265000,
            "premium_after": 0,
            "changes": ["QA improvement noted but 185% loss ratio and 4 repeat claims indicate systemic issue", "Decline decision upheld"],
        },
    ],
}


def get_reasons_for_policy(policy_ref: str) -> list[dict] | None:
    return POLICY_REASONS.get(policy_ref)


def get_rerating_history(policy_ref: str) -> list[dict] | None:
    return RERATING_HISTORY.get(policy_ref, [])
