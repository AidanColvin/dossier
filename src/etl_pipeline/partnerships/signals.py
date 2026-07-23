"""the evidence shapes partnership intelligence produces.

each dataclass is one kind of primary-source evidence; detect_signals turns
the full evidence set into ranked relationship signals. detection is rule
based and deterministic: a signal is confirmed only when the tie is explicit
in the source (the company's own filing, a named trial collaboration), and
probable when the evidence is real but indirect (co-authorship, a grant
abstract naming the company).
"""
from dataclasses import dataclass, field

STRENGTH_CONFIRMED = "confirmed"
STRENGTH_PROBABLE = "probable"


@dataclass
class CoauthoredPaper:
    """one work with authors at both the company and the institution."""

    title: str
    url: str
    date: str
    journal: str = ""


@dataclass
class PartnerTrial:
    """one clinical trial tying the company to the institution.

    is_joint is True when the institution appears as a named collaborator,
    the strongest form; otherwise the institution matched the study text or
    sites, which is real but weaker evidence.
    """

    nct_id: str
    title: str
    status: str
    date: str
    url: str
    is_joint: bool = False


@dataclass
class FacultyLead:
    """one grant at the institution whose project text names the company.

    the named principal investigators are the people who already work with
    or on the company's technology, which makes them the natural first
    contacts.
    """

    pi_names: list[str]
    department: str
    project_num: str
    title: str
    fiscal_year: str
    award_amount: float | None
    url: str


@dataclass
class FilingMention:
    """one company sec filing whose full text mentions the institution."""

    form: str
    filed: str
    accession: str
    url: str


@dataclass
class RelationshipSignal:
    """one ranked, sourced statement about the relationship."""

    strength: str
    kind: str
    description: str
    url: str = ""


@dataclass
class PartnershipEvidence:
    """everything the resolver found, before signal detection."""

    papers: list[CoauthoredPaper] = field(default_factory=list)
    trials: list[PartnerTrial] = field(default_factory=list)
    faculty_leads: list[FacultyLead] = field(default_factory=list)
    filing_mentions: list[FilingMention] = field(default_factory=list)


def detect_signals(company: str, institution: str,
                   evidence: PartnershipEvidence) -> list[RelationshipSignal]:
    """
    given the company and institution names and the collected evidence
    return relationship signals ordered confirmed first

    every signal quotes its count and carries one representative url, so a
    reader can always click through to the strongest piece of evidence.
    """
    signals: list[RelationshipSignal] = []

    if evidence.filing_mentions:
        newest = evidence.filing_mentions[0]
        signals.append(RelationshipSignal(
            strength=STRENGTH_CONFIRMED,
            kind="filing_mention",
            description=(f"{company}'s own {newest.form or 'SEC'} filing "
                         f"mentions {institution} "
                         f"({len(evidence.filing_mentions)} filing(s))"),
            url=newest.url))

    joint = [t for t in evidence.trials if t.is_joint]
    if joint:
        signals.append(RelationshipSignal(
            strength=STRENGTH_CONFIRMED,
            kind="joint_trial",
            description=(f"{institution} is a named collaborator on "
                         f"{len(joint)} of {company}'s clinical trials"),
            url=joint[0].url))

    site_only = [t for t in evidence.trials if not t.is_joint]
    if site_only:
        signals.append(RelationshipSignal(
            strength=STRENGTH_PROBABLE,
            kind="trial_overlap",
            description=(f"{len(site_only)} of {company}'s trials involve "
                         f"{institution} without a named collaboration"),
            url=site_only[0].url))

    if evidence.papers:
        signals.append(RelationshipSignal(
            strength=STRENGTH_PROBABLE,
            kind="coauthorship",
            description=(f"researchers at {company} and {institution} "
                         f"co-authored {len(evidence.papers)} recent paper(s)"),
            url=evidence.papers[0].url))

    if evidence.faculty_leads:
        signals.append(RelationshipSignal(
            strength=STRENGTH_PROBABLE,
            kind="funded_research",
            description=(f"{len(evidence.faculty_leads)} federally funded "
                         f"project(s) at {institution} name {company}"),
            url=evidence.faculty_leads[0].url))

    order = {STRENGTH_CONFIRMED: 0, STRENGTH_PROBABLE: 1}
    return sorted(signals, key=lambda s: order[s.strength])
