/**
 * Canonical Emergency Incident Model (CEIM) — mobile mirror.
 *
 * Field-for-field mirror of app/backend/schemas/ceim.py. Kept in sync by
 * hand for now (no shared workspace package yet, same accepted gap already
 * documented for knowledge.ts/brief.ts and the i18n locale files) — treat
 * any drift between the two as a defect. See ResQKit_Canonical_Incident_Model.md
 * for the full design rationale.
 *
 * Safety invariant (enforced server-side in services/ceim.py, mirrored here
 * only as documentation): a victim's `responsive`/`breathing` facts always
 * carry source='button_selected'. The AI interview below never populates or
 * overwrites those two fields, under any circumstance — they are what
 * routes routeProcedure() to CPR.
 */
import { IncidentState } from './storage';

export const CEIM_SCHEMA_VERSION = '0.1.0';

export type CeimSource =
  | 'bystander_stated'
  | 'button_selected'
  | 'device_sensor'
  | 'ai_inferred'
  | 'not_recorded';

export type CeimConfidence = 'high' | 'medium' | 'low';

export interface Fact<T> {
  value: T | null;
  source: CeimSource;
  confidence: CeimConfidence;
  note?: string | null;
}

export interface CeimLocation {
  latitude?: Fact<number> | null;
  longitude?: Fact<number> | null;
  accuracy_m?: Fact<number> | null;
  description?: Fact<string> | null;
}

export interface CeimVictim {
  index: number;
  responsive?: Fact<string> | null;
  breathing?: Fact<string> | null;
  age_band?: Fact<string> | null;
  injury_type?: Fact<string> | null;
  trapped?: Fact<string> | null;
  condition_description?: Fact<string> | null;
}

export interface CeimHazard {
  code?: Fact<string> | null;
  description: Fact<string>;
}

export interface CeimIncident {
  ceim_schema_version: string;
  generated_at: string;
  content_pack_version: string;
  incident_type?: Fact<string> | null;
  called_112?: Fact<string> | null;
  location: CeimLocation;
  victim_count?: Fact<number> | null;
  victims: CeimVictim[];
  hazards: CeimHazard[];
  scene_observations: Fact<string>[];
  additional_notes?: Fact<string> | null;
  degraded: boolean;
}

/* ------------------------------------------------------------------ *
 * Request/response contract for POST /api/v1/resqkit/ceim/generate
 * ------------------------------------------------------------------ */

export interface KnownFacts {
  incident_type: string | null;
  called_112: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  location_note: string | null;
  victim_count: number | null;
  responsive: string | null;
  breathing: string | null;
  injury: string | null;
  age_band: string | null;
  trapped: string | null;
}

export interface InterviewAnswerIn {
  prompt_id: string;
  prompt_text: string;
  answer_text: string;
}

export interface CeimGenerateRequest {
  known_facts: KnownFacts;
  interview_answers: InterviewAnswerIn[];
  content_pack_version: string;
}

export interface CeimGenerateResponse {
  ceim: CeimIncident;
  degraded: boolean;
  model: string;
}

/**
 * Derives the request's `known_facts` from an incident's already-captured
 * button/sensor fields, so no screen has to hand-assemble this shape ad hoc.
 */
export function buildKnownFactsFromIncident(incident: IncidentState): KnownFacts {
  return {
    incident_type: incident.context,
    called_112: incident.called112,
    latitude: incident.latitude,
    longitude: incident.longitude,
    accuracy_m: incident.accuracy,
    location_note: incident.locationNote || null,
    victim_count: incident.victimCount,
    responsive: incident.responsive || null,
    breathing: incident.breathing || null,
    injury: incident.injury || null,
    age_band: incident.ageBand || null,
    trapped: incident.trapped || null,
  };
}

/**
 * The fixed prompt set (design decision A2): pre-written, not model-generated,
 * so answering them costs zero AI latency. Every prompt is optional — a
 * bystander must never be blocked by a mandatory field. Ordered to build on
 * what triage already captured, per the interview's placement right after it.
 */
export const INTERVIEW_PROMPTS: { id: string; prompt: string }[] = [
  {
    id: 'scene_description',
    prompt: 'In your own words — what happened, and what do you see right now?',
  },
  {
    id: 'victim_condition',
    prompt:
      'Describe how the injured person looks and acts right now, beyond what you already selected (skin colour, bleeding amount, pain, movement, speech).',
  },
  {
    id: 'hazards_observed',
    prompt:
      'What hazards or dangers do you see, even small ones (traffic, fire, spills, unstable objects, water, crowd)?',
  },
  {
    id: 'access_detail',
    prompt: 'Is anyone trapped or hard to reach? Is anything blocking access for you or for responders?',
  },
  {
    id: 'anything_else',
    prompt:
      'Anything else responders should know before they arrive — weather, number of vehicles, people helping, anything unusual?',
  },
];
