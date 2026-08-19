/**
 * Rescuer handoff brief composition.
 *
 * The brief is assembled DETERMINISTICALLY from captured incident fields, in
 * the order rescuers prioritise (RESPONDER_PRIORITIES). AI is optional polish
 * on top of this text and can never introduce a fact that is not already here.
 */

import {
  CONTENT_PACK_VERSION,
  INJURY_OPTIONS,
  CONTEXTS,
  hazardByCode,
  kitItemByCode,
  procedureById,
} from './knowledge';
import { IncidentState, SafetyProfile } from './localStore';

const label = (value: string, options: { value: string; label: string }[]) =>
  options.find((o) => o.value === value)?.label ?? value;

const yesNoUnsure = (v: string) => {
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  if (v === 'unsure') return 'Unsure';
  return 'Not recorded';
};

export const formatCoords = (incident: IncidentState): string => {
  if (incident.latitude === null || incident.longitude === null) {
    return 'No satellite fix captured';
  }
  const acc = incident.accuracy ? ` (±${Math.round(incident.accuracy)} m)` : '';
  return `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}${acc}`;
};

export const fixAgeText = (incident: IncidentState): string => {
  if (!incident.locationFixAt) return '';
  const ageMs = Date.now() - new Date(incident.locationFixAt).getTime();
  const mins = Math.floor(ageMs / 60000);
  if (mins < 1) return 'fix taken just now';
  if (mins === 1) return 'fix taken 1 minute ago';
  return `fix taken ${mins} minutes ago`;
};

const called112Text = (v: IncidentState['called112']) => {
  if (v === 'called') return '112 called from this app';
  if (v === 'already_called') return '112 already called by someone on scene';
  return 'NOT CONFIRMED — ask whether 112 has been called';
};

export interface BriefOptions {
  includeHealth: boolean;
  includeReporter: boolean;
}

export const buildBrief = (
  incident: IncidentState,
  profile: SafetyProfile,
  options: BriefOptions,
): string => {
  const lines: string[] = [];
  const ctx = CONTEXTS.find((c) => c.id === incident.context);

  lines.push('RESQKIT SCENE BRIEF');
  lines.push(`Incident started: ${new Date(incident.startedAt).toLocaleString()}`);
  lines.push(`Emergency call status: ${called112Text(incident.called112)}`);
  lines.push('');

  lines.push('1. LOCATION');
  lines.push(`   Coordinates: ${formatCoords(incident)}`);
  const age = fixAgeText(incident);
  if (age) lines.push(`   Fix age: ${age}`);
  if (incident.locationNote) lines.push(`   Description: ${incident.locationNote}`);
  lines.push(`   Environment: ${ctx ? ctx.label : 'Not recorded'}`);
  lines.push('');

  lines.push('2. VICTIMS');
  lines.push(`   Reported count: ${incident.victimCount} (reported by bystander, not verified)`);
  lines.push('');

  lines.push('3. PRIMARY VICTIM STATUS');
  lines.push(`   Responsive: ${yesNoUnsure(incident.responsive)}`);
  lines.push(`   Breathing normally: ${yesNoUnsure(incident.breathing)}`);
  lines.push(
    `   Injury: ${incident.injury ? label(incident.injury, INJURY_OPTIONS) : 'Not recorded'}`,
  );
  if (incident.ageBand) lines.push(`   Approximate age: ${incident.ageBand}`);
  if (incident.trapped) lines.push(`   Access: ${incident.trapped}`);
  lines.push('');

  lines.push('4. HAZARDS ON SCENE');
  if (incident.hazards.length === 0) {
    lines.push('   None reported by the bystander');
  } else {
    incident.hazards.forEach((code) => {
      const h = hazardByCode(code);
      lines.push(`   - ${h ? h.label : code}${h?.blocking ? ' [approach restricted]' : ''}`);
    });
  }
  if (incident.powertrain) lines.push(`   Vehicle powertrain: ${incident.powertrain}`);
  lines.push('');

  lines.push('5. MEDICAL INFORMATION');
  if (!options.includeHealth) {
    lines.push('   Withheld by the user (not shared)');
  } else {
    const rows: string[] = [];
    if (profile.bloodType) rows.push(`   Blood type: ${profile.bloodType}`);
    if (profile.allergies) rows.push(`   Allergies: ${profile.allergies}`);
    if (profile.conditions) rows.push(`   Conditions: ${profile.conditions}`);
    if (profile.medications) rows.push(`   Medications: ${profile.medications}`);
    if (profile.implants) rows.push(`   Implants / devices: ${profile.implants}`);
    if (rows.length === 0) {
      lines.push('   No Safety Profile medical facts recorded');
    } else {
      rows.forEach((r) => lines.push(r));
      lines.push('   (Self-reported by the app user, from a locally stored Safety Profile)');
    }
  }
  lines.push('');

  lines.push('6. ACTIONS ALREADY TAKEN');
  const proc = incident.procedureId ? procedureById(incident.procedureId) : undefined;
  if (proc) lines.push(`   Guidance followed: ${proc.name}`);
  if (incident.completedSteps.length === 0) {
    lines.push('   No steps recorded as completed');
  } else {
    incident.completedSteps.forEach((s) => {
      lines.push(`   - ${new Date(s.at).toLocaleTimeString()} — ${s.title}`);
    });
  }
  lines.push('');

  if (incident.kitItems.length > 0) {
    lines.push('7. EQUIPMENT USED / AVAILABLE');
    incident.kitItems.forEach((code) => {
      const item = kitItemByCode(code);
      lines.push(`   - ${item ? item.name : code}`);
    });
    lines.push('');
  }

  if (options.includeReporter && (incident.reporterName || incident.reporterPhone)) {
    lines.push('8. REPORTER');
    if (incident.reporterName) lines.push(`   Name: ${incident.reporterName}`);
    if (incident.reporterPhone) lines.push(`   Phone: ${incident.reporterPhone}`);
    lines.push('');
  }

  lines.push(
    `Prepared with ResQKit — an assistance aid, not an emergency service. Content pack ${incident.contentPackVersion || CONTENT_PACK_VERSION}.`,
  );

  return lines.join('\n');
};

/**
 * Dispatcher script for the 112 gate. Built only from what is already known;
 * placeholders are explicit so the caller does not read out invented facts.
 */
export const buildDispatcherScript = (incident: IncidentState): string => {
  const ctx = CONTEXTS.find((c) => c.id === incident.context);
  const lines: string[] = [];
  lines.push('Say to the 112 operator:');
  lines.push('');
  lines.push(
    `"I need an ambulance. The incident is ${ctx ? ctx.label.toLowerCase() : 'at my current position'}."`,
  );
  if (incident.latitude !== null && incident.longitude !== null) {
    lines.push(`"My coordinates are ${formatCoords(incident)}."`);
  } else {
    lines.push('"I will describe my exact position now."');
  }
  if (incident.locationNote) lines.push(`"Landmark: ${incident.locationNote}."`);
  lines.push(`"There ${incident.victimCount === 1 ? 'is 1 injured person' : `are ${incident.victimCount} injured people`}."`);
  if (incident.injury) {
    lines.push(`"The main problem is ${label(incident.injury, INJURY_OPTIONS).toLowerCase()}."`);
  }
  if (incident.breathing === 'no') {
    lines.push('"The person is NOT breathing." — say this first, it changes their response.');
  }
  if (incident.hazards.length > 0) {
    const names = incident.hazards.map((c) => hazardByCode(c)?.label ?? c).join(', ');
    lines.push(`"Hazards on scene: ${names}."`);
  }
  lines.push('');
  lines.push('Then stay on the line and follow the operator\'s instructions.');
  return lines.join('\n');
};