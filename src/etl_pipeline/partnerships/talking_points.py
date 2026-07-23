"""deterministic talking points: template assembly over partnership evidence.

no model, no key, no cost. the rules mirror how a partnership office would
actually rank an outreach list: confirmed relationships first, then the
funded researchers to contact, then joint work, then openings. capped at
eight so the list stays usable in an email.
"""
from dataclasses import dataclass

from etl_pipeline.partnerships.signals import (
    STRENGTH_CONFIRMED,
    PartnershipEvidence,
    RelationshipSignal,
)

MAX_POINTS = 8
MAX_FACULTY_POINTS = 3
MAX_TRIAL_POINTS = 3
MAX_PAPER_POINTS = 2

CATEGORY_RELATIONSHIP = "Existing Relationship"
CATEGORY_CONTACT = "Contact"
CATEGORY_OVERLAP = "Research Overlap"
CATEGORY_OPPORTUNITY = "Partnership Opportunity"

HIGH = "high"
MEDIUM = "medium"
LOW = "low"

_STRENGTH_ORDER = {HIGH: 0, MEDIUM: 1, LOW: 2}


@dataclass
class TalkingPoint:
    """one ranked outreach point, ready to paste into an email."""

    category: str
    headline: str
    detail: str
    strength: str
    url: str = ""


def _signal_points(signals: list[RelationshipSignal]) -> list[TalkingPoint]:
    """
    given the detected relationship signals
    return one relationship point per signal, confirmed ranked high
    """
    points = []
    for signal in signals:
        strength = HIGH if signal.strength == STRENGTH_CONFIRMED else MEDIUM
        points.append(TalkingPoint(
            category=CATEGORY_RELATIONSHIP,
            headline=signal.description,
            detail=f"source: {signal.url}" if signal.url else "",
            strength=strength,
            url=signal.url))
    return points


def _faculty_points(evidence: PartnershipEvidence) -> list[TalkingPoint]:
    """
    given the evidence
    return contact points for the newest funded investigators
    """
    newest = sorted(evidence.faculty_leads,
                    key=lambda lead: lead.fiscal_year, reverse=True)
    points = []
    for lead in newest[:MAX_FACULTY_POINTS]:
        names = ", ".join(lead.pi_names) or "the project team"
        funded = (f"funded at ${lead.award_amount:,.0f} (FY{lead.fiscal_year})"
                  if lead.award_amount else f"active in FY{lead.fiscal_year}")
        points.append(TalkingPoint(
            category=CATEGORY_CONTACT,
            headline=f"{names} already works on this: {lead.title}",
            detail=f"{lead.project_num}, {funded}",
            strength=HIGH if lead.award_amount else MEDIUM,
            url=lead.url))
    return points


def _trial_points(evidence: PartnershipEvidence) -> list[TalkingPoint]:
    """
    given the evidence
    return overlap points for joint trials
    """
    joint = [t for t in evidence.trials if t.is_joint]
    return [TalkingPoint(
        category=CATEGORY_OVERLAP,
        headline=f"joint trial {trial.nct_id}: {trial.title}",
        detail=f"status {trial.status or 'unknown'}, started {trial.date or 'n/a'}",
        strength=HIGH,
        url=trial.url) for trial in joint[:MAX_TRIAL_POINTS]]


def _paper_points(evidence: PartnershipEvidence) -> list[TalkingPoint]:
    """
    given the evidence
    return opportunity points for the newest co-authored papers
    """
    return [TalkingPoint(
        category=CATEGORY_OPPORTUNITY,
        headline=f"co-authored: {paper.title}",
        detail=paper.journal or paper.date,
        strength=MEDIUM,
        url=paper.url) for paper in evidence.papers[:MAX_PAPER_POINTS]]


def build_talking_points(company: str, institution: str,
                         evidence: PartnershipEvidence,
                         signals: list[RelationshipSignal]) -> list[TalkingPoint]:
    """
    given the names, the evidence, and the detected signals
    return up to eight ranked talking points, never an empty list

    when nothing at all connects the two, the single low point says so
    plainly, which is itself useful: the outreach angle is a fresh start,
    not a warm lead.
    """
    points = (_signal_points(signals) + _faculty_points(evidence)
              + _trial_points(evidence) + _paper_points(evidence))
    if not points:
        return [TalkingPoint(
            category=CATEGORY_OVERLAP,
            headline=(f"no existing relationship found between {company} "
                      f"and {institution}"),
            detail="every source was checked; outreach would start fresh",
            strength=LOW)]
    ordered = sorted(points, key=lambda p: _STRENGTH_ORDER[p.strength])
    return ordered[:MAX_POINTS]
