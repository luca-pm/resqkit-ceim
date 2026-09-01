/**
 * ResQKit curated content pack.
 *
 * EVERY entry in this file carries an explicit `source` reference to a research
 * deliverable in the repository root. This file is the ONLY origin of first-aid
 * steps, hazard taxonomy, kit inventories and regulatory obligations shown in
 * the app. AI models are never allowed to author or extend this content — they
 * may only rephrase entries that already exist here.
 *
 * Sources referenced by short code:
 *  - EU_REG  -> /eu_regulations_emergency_response_data_handling_report.md
 *  - RESP    -> /web_info_summaries/essential_emergency_responder_information.md
 *  - AR      -> /web_info_summaries/Augmented_Reality_in_Emergency_First_Aid_and_Kit_Recognition.md
 *  - MVP     -> /ResQKit_MVP_Screens_and_User_Flow.md
 */

/* Bumped when curated safety content changes, because every incident and
   handoff brief is stamped with this for provenance. 1.1.0: the burns
   escalation criteria moved out of the step sequence into Procedure.escalation
   so they are read before the first action rather than after it. */
export const CONTENT_PACK_VERSION = '1.1.0-mvp';
export const CONTENT_PACK_UPDATED = '2026-09-02';

export const SOURCE_DOCS: Record<string, string> = {
  EU_REG: 'eu_regulations_emergency_response_data_handling_report.md',
  RESP: 'web_info_summaries/essential_emergency_responder_information.md',
  AR: 'web_info_summaries/Augmented_Reality_in_Emergency_First_Aid_and_Kit_Recognition.md',
  MVP: 'ResQKit_MVP_Screens_and_User_Flow.md',
};

export type ContextId = 'road' | 'office' | 'maritime' | 'mountain' | 'other';

export interface EnvironmentContext {
  id: ContextId;
  label: string;
  blurb: string;
  icon: string;
}

export const CONTEXTS: EnvironmentContext[] = [
  {
    id: 'road',
    label: 'Road / Vehicle',
    blurb: 'Car, van or motorcycle incident on or beside a road.',
    icon: 'car',
  },
  {
    id: 'office',
    label: 'Workplace / Office',
    blurb: 'Indoor workplace, school, shop or public building.',
    icon: 'building',
  },
  {
    id: 'maritime',
    label: 'Maritime / Water',
    blurb: 'On board a vessel, at a harbour, lake or coastline.',
    icon: 'anchor',
  },
  {
    id: 'mountain',
    label: 'Mountain / Outdoor',
    blurb: 'Trail, forest, altitude or remote terrain.',
    icon: 'mountain',
  },
  {
    id: 'other',
    label: 'Other / Unknown',
    blurb: 'Anything that does not match the categories above.',
    icon: 'help',
  },
];

/* ------------------------------------------------------------------ *
 * Kit inventory
 * Item set per context. Camera recognition is constrained to these
 * codes; the model may not return anything outside this list.
 * ------------------------------------------------------------------ */

export interface KitItem {
  code: string;
  name: string;
  purpose: string;
  howTo: string;
  contexts: ContextId[];
}

export const KIT_ITEMS: KitItem[] = [
  {
    code: 'gloves',
    name: 'Disposable gloves',
    purpose: 'Barrier protection for you and the injured person.',
    howTo: 'Put them on before touching wounds or body fluids. Replace if torn.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'pressure_bandage',
    name: 'Pressure bandage',
    purpose: 'Applies sustained pressure over a bleeding wound.',
    howTo: 'Place the pad directly on the wound and wrap firmly, not so tight that the limb goes cold.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'sterile_gauze',
    name: 'Sterile gauze pads',
    purpose: 'Absorbent dressing placed directly on a wound.',
    howTo: 'Stack pads over the wound and hold firm pressure. Add more on top; do not remove soaked ones.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'triangular_bandage',
    name: 'Triangular bandage',
    purpose: 'Sling, limb support or padding.',
    howTo: 'Use as an arm sling or to hold a splint and dressings in place.',
    contexts: ['road', 'office', 'mountain'],
  },
  {
    code: 'tourniquet',
    name: 'Tourniquet',
    purpose: 'Last-resort control of life-threatening limb bleeding.',
    howTo:
      'Only for a limb, only when direct pressure fails. Place above the wound, tighten until bleeding stops, note the time.',
    contexts: ['road', 'mountain', 'maritime'],
  },
  {
    code: 'adhesive_plaster',
    name: 'Adhesive plasters',
    purpose: 'Small wound coverage.',
    howTo: 'Clean and dry the skin, then cover the wound completely.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'antiseptic',
    name: 'Antiseptic wipes or solution',
    purpose: 'Cleaning intact skin around a minor wound.',
    howTo: 'Wipe outward from the wound edge. Do not pour into deep wounds.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'burn_dressing',
    name: 'Burn dressing or gel pad',
    purpose: 'Non-adherent cover for a cooled burn.',
    howTo: 'Apply after cooling the burn with water. Do not use on top of dirt or clothing stuck to the skin.',
    contexts: ['office', 'maritime', 'road'],
  },
  {
    code: 'thermal_blanket',
    name: 'Thermal / foil blanket',
    purpose: 'Reduces heat loss and shock.',
    howTo: 'Wrap around the person including the head, leaving the face clear.',
    contexts: ['road', 'maritime', 'mountain', 'office'],
  },
  {
    code: 'scissors',
    name: 'Shears or scissors',
    purpose: 'Cutting dressings, tape or clothing away from a wound.',
    howTo: 'Cut along seams where possible. Never cut through an embedded object.',
    contexts: ['road', 'office', 'maritime', 'mountain'],
  },
  {
    code: 'cpr_shield',
    name: 'CPR face shield or pocket mask',
    purpose: 'Barrier for rescue breaths.',
    howTo: 'Place over the mouth and nose. If you are untrained or unwilling, do compressions only.',
    contexts: ['office', 'road', 'maritime'],
  },
  {
    code: 'aed',
    name: 'AED (defibrillator)',
    purpose: 'Analyses the heart rhythm and delivers a shock if advised.',
    howTo: 'Switch it on and follow its spoken prompts. It will not shock unless a shock is needed.',
    contexts: ['office', 'maritime'],
  },
  {
    code: 'eyewash',
    name: 'Eyewash / saline',
    purpose: 'Flushing chemicals or debris from the eye.',
    howTo: 'Irrigate from the inner corner outward for several minutes, keeping the eye open.',
    contexts: ['office', 'maritime'],
  },
  {
    code: 'cold_pack',
    name: 'Instant cold pack',
    purpose: 'Reduces swelling in sprains and bruises.',
    howTo: 'Wrap in cloth before contact with skin. Do not use on open wounds or burns.',
    contexts: ['office', 'mountain', 'road'],
  },
  {
    code: 'splint',
    name: 'Mouldable splint',
    purpose: 'Immobilises a suspected fracture.',
    howTo: 'Shape it to support the limb in the position found. Pad it and secure above and below the injury.',
    contexts: ['mountain', 'office', 'road'],
  },
  {
    code: 'warning_triangle',
    name: 'Warning triangle',
    purpose: 'Makes the scene visible to other traffic.',
    howTo: 'Place well back from the vehicle in the direction of oncoming traffic before you approach.',
    contexts: ['road'],
  },
  {
    code: 'hi_vis_vest',
    name: 'High-visibility vest',
    purpose: 'Makes you visible on a road scene.',
    howTo: 'Put it on before leaving the vehicle.',
    contexts: ['road'],
  },
  {
    code: 'fire_extinguisher',
    name: 'Fire extinguisher',
    purpose: 'Small fire suppression only.',
    howTo: 'Only attempt a small, contained fire with an escape route behind you. Otherwise withdraw.',
    contexts: ['road', 'office', 'maritime'],
  },
  {
    code: 'life_jacket',
    name: 'Life jacket / buoyancy aid',
    purpose: 'Keeps a person afloat.',
    howTo: 'Put yours on before helping. Secure all straps.',
    contexts: ['maritime'],
  },
  {
    code: 'throw_line',
    name: 'Throw line or ring buoy',
    purpose: 'Reaching a person in water without entering it.',
    howTo: 'Throw past the person and pull it back into their reach. Do not enter the water yourself.',
    contexts: ['maritime'],
  },
  {
    code: 'whistle',
    name: 'Whistle',
    purpose: 'Audible signalling when your voice or phone fails.',
    howTo: 'Six blasts, pause one minute, repeat.',
    contexts: ['mountain', 'maritime'],
  },
  {
    code: 'bivvy_bag',
    name: 'Bivvy bag / emergency shelter',
    purpose: 'Protection from wind, rain and cold.',
    howTo: 'Get the person off the ground first, then enclose them.',
    contexts: ['mountain'],
  },
  {
    code: 'headlamp',
    name: 'Headlamp or torch',
    purpose: 'Hands-free light and signalling.',
    howTo: 'Use to work on the casualty and to mark your position for rescuers.',
    contexts: ['mountain', 'maritime', 'road'],
  },
];

export const kitItemsForContext = (context: ContextId): KitItem[] =>
  KIT_ITEMS.filter((item) => item.contexts.includes(context === 'other' ? 'office' : context));

export const kitItemByCode = (code: string): KitItem | undefined =>
  KIT_ITEMS.find((item) => item.code === code);

/* ------------------------------------------------------------------ *
 * Hazard taxonomy
 * Derived from RESP: CBRNE, structural, environmental and other hazard
 * families, reduced to what an untrained bystander can actually observe.
 * ------------------------------------------------------------------ */

export interface Hazard {
  code: string;
  label: string;
  family: string;
  warning: string;
  blocking: boolean;
  contexts: ContextId[];
}

export const HAZARDS: Hazard[] = [
  {
    code: 'traffic',
    label: 'Moving traffic',
    family: 'Other',
    warning: 'Make the scene visible and stay behind a barrier before approaching.',
    blocking: false,
    contexts: ['road'],
  },
  {
    code: 'fire',
    label: 'Fire or smoke',
    family: 'Other',
    warning: 'Do not enter smoke. Withdraw upwind and keep others back.',
    blocking: true,
    contexts: ['road', 'office', 'maritime', 'mountain', 'other'],
  },
  {
    code: 'fuel_spill',
    label: 'Fuel or chemical spill',
    family: 'CBRNE',
    warning: 'No ignition sources. Stay upwind and uphill. Do not walk through the spill.',
    blocking: true,
    contexts: ['road', 'office', 'maritime', 'other'],
  },
  {
    code: 'electrical',
    label: 'Electrical / high voltage',
    family: 'Structural',
    warning: 'Assume cables are live. Keep well clear and wait for the utility or fire service.',
    blocking: true,
    contexts: ['road', 'office', 'maritime', 'other'],
  },
  {
    code: 'ev_battery',
    label: 'Electric vehicle / traction battery',
    family: 'Structural',
    warning:
      'High-voltage risk and possible delayed re-ignition. Tell the dispatcher it is an EV — extrication procedure differs.',
    blocking: true,
    contexts: ['road'],
  },
  {
    code: 'water',
    label: 'Water / drowning risk',
    family: 'Environmental',
    warning: 'Reach or throw, do not go. Never enter the water to rescue.',
    blocking: true,
    contexts: ['maritime', 'mountain', 'other'],
  },
  {
    code: 'unstable_structure',
    label: 'Unstable structure or load',
    family: 'Structural',
    warning: 'Do not enter or crawl under. Note the location for rescuers instead.',
    blocking: true,
    contexts: ['office', 'road', 'maritime', 'mountain', 'other'],
  },
  {
    code: 'gas',
    label: 'Gas smell or confined space',
    family: 'CBRNE',
    warning: 'Do not switch anything on or off. Ventilate if safe, evacuate, and do not enter confined spaces.',
    blocking: true,
    contexts: ['office', 'maritime', 'other'],
  },
  {
    code: 'exposure',
    label: 'Cold, heat or exposure',
    family: 'Environmental',
    warning: 'Insulate from the ground and shelter from wind. Exposure worsens every other injury.',
    blocking: false,
    contexts: ['mountain', 'maritime', 'road', 'other'],
  },
  {
    code: 'rockfall',
    label: 'Rockfall, avalanche or steep drop',
    family: 'Environmental',
    warning: 'Do not cross the hazard. Move to stable ground and mark your position.',
    blocking: true,
    contexts: ['mountain'],
  },
  {
    code: 'aggression',
    label: 'Aggression or crowd',
    family: 'Other',
    warning: 'Your safety first. Withdraw to a safe distance and let the dispatcher know.',
    blocking: false,
    contexts: ['road', 'office', 'maritime', 'mountain', 'other'],
  },
];

export const hazardsForContext = (context: ContextId): Hazard[] =>
  HAZARDS.filter((h) => h.contexts.includes(context));

export const hazardByCode = (code: string): Hazard | undefined =>
  HAZARDS.find((h) => h.code === code);

/* ------------------------------------------------------------------ *
 * Guided procedures
 *
 * Procedure SET (which procedures exist in the MVP) is fixed by MVP §S8.
 * Procedure categories are corroborated by AR (CPR/AED, severe
 * haemorrhage/tourniquet, choking, burns, fractures, hypothermia).
 *
 * `clinicalReview: 'pending'` is surfaced in the UI on every procedure:
 * these steps are a bystander orientation aid and independent clinical
 * sign-off is an explicit pre-launch gate (MVP §4, item 20/21).
 * ------------------------------------------------------------------ */

export interface ProcedureStep {
  title: string;
  detail: string;
  critical?: boolean;
  metronomeBpm?: number;
  requiresItems?: string[];
  withoutItem?: string;
}

export interface Procedure {
  id: string;
  name: string;
  shortLabel: string;
  whenToUse: string;
  /**
   * Red flags that make this a 112 case, shown above the steps and kept on
   * screen throughout — never as a step.
   *
   * Escalation criteria are not actions you perform and tick off, they decide
   * whether the bystander should be calling instead of treating. Burns had
   * these as the final step, so the instruction to call 112 for a facial or
   * airway burn arrived only after a full 20-minute cooling step. Anything
   * that changes whether to call must be readable before the first action.
   *
   * Optional: a procedure without distinct red flags (the whole of CPR is
   * already a 112 case) leaves it unset rather than carrying filler.
   */
  escalation?: string;
  steps: ProcedureStep[];
  sources: string[];
  clinicalReview: 'pending' | 'verified';
}

export const PROCEDURES: Procedure[] = [
  {
    id: 'cpr_aed',
    name: 'Unresponsive and not breathing — CPR and AED',
    shortLabel: 'CPR / AED',
    whenToUse: 'The person does not respond and is not breathing normally.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    steps: [
      {
        title: 'Confirm 112 is on the way',
        detail:
          'Shout for help. If nobody has called 112, call now on speaker so you can keep your hands free. Ask for an ambulance and say the person is not breathing.',
        critical: true,
      },
      {
        title: 'Open the airway and check breathing',
        detail:
          'Tilt the head back gently and lift the chin. Look, listen and feel for no more than 10 seconds. Occasional gasping is NOT normal breathing.',
        critical: true,
      },
      {
        title: 'Start chest compressions',
        detail:
          'Place the heel of one hand in the centre of the chest, the other hand on top. Push hard and fast, about 5–6 cm deep, letting the chest come all the way back up between compressions. Keep the rhythm of the metronome.',
        critical: true,
        metronomeBpm: 110,
      },
      {
        title: 'Send someone for the AED',
        detail:
          'If a defibrillator is nearby, send another person to fetch it while you keep compressing. Do not stop compressions to look for it yourself.',
        requiresItems: ['aed'],
        withoutItem: 'No AED here. Keep compressing without interruption until help arrives.',
      },
      {
        title: 'Use the AED as soon as it arrives',
        detail:
          'Switch it on and follow its spoken prompts exactly. Bare the chest, attach the pads as pictured, and make sure nobody is touching the person when it advises a shock.',
        requiresItems: ['aed'],
      },
      {
        title: 'Rescue breaths only if trained and willing',
        detail:
          'If you are trained and have a barrier, give 2 breaths after every 30 compressions. If not, compression-only CPR is the correct choice — do not stop.',
        requiresItems: ['cpr_shield'],
        withoutItem: 'No barrier available. Do compression-only CPR. This is correct and effective.',
      },
      {
        title: 'Keep going until relieved',
        detail:
          'Continue until the ambulance crew takes over, the person starts breathing normally, or you are physically unable. Swap with another helper every 2 minutes if possible.',
        critical: true,
      },
    ],
  },
  {
    id: 'severe_bleeding',
    name: 'Severe bleeding',
    shortLabel: 'Severe bleeding',
    whenToUse: 'Blood is pouring, spurting, or soaking through clothing.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    steps: [
      {
        title: 'Protect yourself',
        detail: 'Put on gloves if you have them. If not, use any clean barrier such as a plastic bag.',
        requiresItems: ['gloves'],
        withoutItem: 'No gloves. Use a plastic bag or clean cloth as a barrier and wash thoroughly afterwards.',
      },
      {
        title: 'Apply direct pressure now',
        detail:
          'Press firmly straight onto the wound with a gauze pad or the cleanest cloth available. Do not stop to look for better materials.',
        critical: true,
        requiresItems: ['sterile_gauze'],
        withoutItem: 'Use the cleanest available cloth or your gloved hand and press hard and continuously.',
      },
      {
        title: 'Add a pressure bandage',
        detail:
          'Wrap firmly over the pad to hold the pressure. If blood soaks through, add more on top — never remove the first dressing.',
        requiresItems: ['pressure_bandage'],
        withoutItem: 'Keep pressing by hand and hold it without releasing.',
      },
      {
        title: 'Raise the limb if possible',
        detail: 'If the wound is on an arm or leg and there is no suspected fracture, raise it above chest level.',
      },
      {
        title: 'Tourniquet only if bleeding will not stop',
        detail:
          'For a limb only, when direct pressure has failed and the bleeding is life-threatening: place it 5–7 cm above the wound, tighten until the bleeding stops, and write down the time applied. Do not loosen it.',
        critical: true,
        requiresItems: ['tourniquet'],
        withoutItem:
          'No tourniquet in this kit. Maintain the hardest possible direct pressure and tell the dispatcher the bleeding is not controlled.',
      },
      {
        title: 'Treat for shock and keep warm',
        detail:
          'Lay the person down, keep them still, cover them to prevent heat loss, and keep talking to them until help arrives.',
        requiresItems: ['thermal_blanket'],
        withoutItem: 'Use coats or blankets to insulate them from the ground and the air.',
      },
      {
        title: 'Hand over the time of the tourniquet',
        detail: 'Tell the arriving crew exactly what you did and when. The timing changes their treatment.',
        critical: true,
      },
    ],
  },
  {
    id: 'choking',
    name: 'Choking',
    shortLabel: 'Choking',
    whenToUse: 'The person cannot speak, cough or breathe properly.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    steps: [
      {
        title: 'Ask: can you cough?',
        detail:
          'If they can cough, speak or breathe, encourage them to keep coughing and stay with them. Do not intervene physically.',
        critical: true,
      },
      {
        title: 'Give up to 5 back blows',
        detail:
          'Lean them forward, support the chest with one hand, and strike firmly between the shoulder blades with the heel of your other hand.',
        critical: true,
      },
      {
        title: 'Give up to 5 abdominal thrusts',
        detail:
          'Stand behind them, make a fist just above the navel, grasp it with your other hand and pull sharply inwards and upwards.',
        critical: true,
      },
      {
        title: 'Alternate and call 112',
        detail:
          'Keep alternating 5 back blows and 5 thrusts. If nobody has called 112 yet, call now — obstruction can become cardiac arrest.',
        critical: true,
      },
      {
        title: 'If they become unresponsive',
        detail: 'Lower them to the ground carefully and switch immediately to CPR.',
        critical: true,
      },
      {
        title: 'Always advise medical review after thrusts',
        detail: 'Abdominal thrusts can cause internal injury. They must be checked by a clinician even if they recover.',
      },
    ],
  },
  {
    id: 'burns',
    name: 'Burns and scalds',
    shortLabel: 'Burns',
    whenToUse: 'Heat, steam, hot liquid, friction or chemical damage to the skin.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    escalation:
      'Call 112 for burns larger than the person\'s palm, any burn to face, hands, feet or genitals, any electrical or chemical burn, or if breathing sounds affected.',
    steps: [
      {
        title: 'Stop the burning process',
        detail: 'Remove the person from the heat source. Only tackle a fire if it is small and you have an escape route.',
        critical: true,
      },
      {
        title: 'Cool with running water for 20 minutes',
        detail:
          'Cool water, not ice. Keep going for a full 20 minutes — this is the single most effective action. Remove rings, watches and tight clothing early, but leave anything stuck to the skin.',
        critical: true,
      },
      {
        title: 'Chemical burns — irrigate longer',
        detail:
          'Flush continuously with water and avoid contaminating yourself. For the eye, irrigate from the inner corner outward and keep the eye open.',
        requiresItems: ['eyewash'],
        withoutItem: 'Use clean running water and continue irrigating on the way to help.',
      },
      {
        title: 'Cover loosely',
        detail:
          'Apply a non-adherent burn dressing or cling film laid on lengthways. Do not wrap tightly and do not apply creams, butter or ointments.',
        requiresItems: ['burn_dressing'],
        withoutItem: 'Cling film or a clean, dry, non-fluffy cloth laid loosely over the burn.',
      },
      {
        title: 'Keep the person warm',
        detail: 'Cooling a large burn cools the whole body. Cover unburned areas to prevent hypothermia.',
        requiresItems: ['thermal_blanket'],
        withoutItem: 'Cover unburned areas with any blanket or coat.',
      },
    ],
  },
  {
    id: 'fracture',
    name: 'Suspected fracture',
    shortLabel: 'Fracture',
    whenToUse: 'Deformity, severe pain, inability to bear weight or use the limb.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    steps: [
      {
        title: 'Do not straighten the limb',
        detail: 'Support it in the position you found it. Realigning is not a bystander task.',
        critical: true,
      },
      {
        title: 'Suspected spine, neck or pelvis — do not move',
        detail:
          'If the mechanism suggests a spinal injury, keep the person completely still and wait for the crew unless there is immediate danger such as fire.',
        critical: true,
      },
      {
        title: 'Immobilise with a splint',
        detail: 'Pad the splint, shape it to the limb as found, and secure above and below the injury — never over it.',
        requiresItems: ['splint'],
        withoutItem: 'Improvise with a rolled magazine, trekking pole or padded board, or support the limb by hand.',
      },
      {
        title: 'Support with a sling',
        detail: 'For an arm, a triangular bandage sling reduces movement and pain considerably.',
        requiresItems: ['triangular_bandage'],
        withoutItem: 'Support the arm against the body using a jacket or belt.',
      },
      {
        title: 'Cool and elevate if there is no open wound',
        detail: 'A wrapped cold pack reduces swelling. Never place ice directly on skin.',
        requiresItems: ['cold_pack'],
        withoutItem: 'Skip cooling. Focus on immobilising and keeping the person still.',
      },
      {
        title: 'Cover any open fracture',
        detail:
          'If bone is exposed, cover it with a sterile dressing without pushing anything back in, and tell the dispatcher it is an open fracture.',
        requiresItems: ['sterile_gauze'],
        withoutItem: 'Cover with the cleanest available cloth and do not apply pressure onto the bone.',
      },
    ],
  },
  {
    id: 'hypothermia',
    name: 'Hypothermia and cold exposure',
    shortLabel: 'Hypothermia',
    whenToUse: 'Shivering, confusion, slurred speech, clumsiness or cold pale skin.',
    clinicalReview: 'pending',
    sources: ['AR', 'MVP'],
    steps: [
      {
        title: 'Get out of the wind and off the ground',
        detail: 'Ground contact and wind drain heat fastest. Shelter first, then everything else.',
        critical: true,
      },
      {
        title: 'Handle the person gently',
        detail:
          'In severe hypothermia rough handling can trigger a dangerous heart rhythm. Move them slowly and keep them horizontal.',
        critical: true,
      },
      {
        title: 'Replace wet layers and insulate',
        detail: 'Remove wet clothing if you can do it without chilling them further, then wrap them fully including the head.',
        requiresItems: ['thermal_blanket'],
        withoutItem: 'Use dry spare clothing, sleeping bags or any dry insulating material.',
      },
      {
        title: 'Use a shelter or bivvy bag',
        detail: 'Enclose the person to trap warm air. Add a second person inside for body heat if conditions allow.',
        requiresItems: ['bivvy_bag'],
        withoutItem: 'Improvise a windbreak and share body heat with dry insulation between you and the ground.',
      },
      {
        title: 'Warm drinks only if fully alert',
        detail: 'Never give anything by mouth to a drowsy or confused person. No alcohol.',
      },
      {
        title: 'Signal your position',
        detail:
          'Give rescuers a fixed, findable position. Six whistle blasts or light flashes per minute is the recognised distress signal.',
        requiresItems: ['whistle'],
        withoutItem: 'Use a torch, bright clothing or a phone screen to mark your position.',
      },
    ],
  },
];

export const procedureById = (id: string): Procedure | undefined =>
  PROCEDURES.find((p) => p.id === id);

/**
 * Deterministic procedure routing from triage answers.
 * No model is involved in this decision.
 */
export const routeProcedure = (triage: {
  responsive?: string;
  breathing?: string;
  injury?: string;
}): string => {
  if (triage.breathing === 'no' || (triage.responsive === 'no' && triage.breathing !== 'yes')) {
    return 'cpr_aed';
  }
  switch (triage.injury) {
    case 'bleeding':
      return 'severe_bleeding';
    case 'choking':
      return 'choking';
    case 'burn':
      return 'burns';
    case 'fracture':
      return 'fracture';
    case 'cold':
      return 'hypothermia';
    default:
      return 'severe_bleeding';
  }
};

export const INJURY_OPTIONS = [
  { value: 'bleeding', label: 'Heavy bleeding' },
  { value: 'choking', label: 'Choking / airway blocked' },
  { value: 'burn', label: 'Burn or scald' },
  { value: 'fracture', label: 'Broken bone / suspected fracture' },
  { value: 'head_spine', label: 'Head or spine injury' },
  { value: 'chest', label: 'Chest pain or breathing difficulty' },
  { value: 'cold', label: 'Cold exposure / hypothermia' },
  { value: 'unknown', label: 'Not sure' },
];

/* ------------------------------------------------------------------ *
 * Regulatory obligations — curated, sourced, read-only.
 * Nothing here is generated. Entries without a verified source are
 * represented by PENDING_JURISDICTIONS instead of invented text.
 * ------------------------------------------------------------------ */

export interface Obligation {
  id: string;
  title: string;
  summary: string;
  detail: string;
  instrument: string;
  articles: string;
  jurisdiction: 'EU' | 'EU / Romania';
  sourceDoc: string;
  lastVerified: string;
  tags: string[];
}

export const OBLIGATIONS: Obligation[] = [
  {
    id: 'ecall',
    title: 'New cars call 112 automatically after a serious crash',
    summary:
      'eCall is fitted to new passenger car and light-duty models approved for manufacture after 31 March 2018 and places a free 112 call automatically or manually.',
    detail:
      'The in-vehicle system transmits a Minimum Set of Data including exact location, time of the accident, vehicle identification number and direction of travel. It is dormant until triggered, the data is limited to what is needed, and it is not stored longer than necessary. Third-party service eCall systems that add services require explicit consent for personal data processing.',
    instrument: 'Regulation (EU) 2015/758; Commission Delegated Regulation (EU) No 305/2013; Decision 585/2014',
    articles: 'Type-approval requirements; PSAP infrastructure specifications (EN 16072:2022, EN 16062:2023)',
    jurisdiction: 'EU',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['road', 'communication'],
  },
  {
    id: 'caller_location',
    title: 'Caller location must reach the emergency service on a 112 call',
    summary:
      'Member States must ensure caller location information is available to the authority handling 112 calls.',
    detail:
      'The European Electronic Communications Code defines emergency communication as a communication between an end-user and a Public Safety Answering Point to request and receive emergency relief. Delegated Regulation (EU) 2023/444 supplements it with caller location solutions, access for end-users with disabilities, and routing to the most appropriate PSAP, including the migration to packet-switched technologies such as VoLTE, VoNR and VoWiFi.',
    instrument: 'Directive (EU) 2018/1972 (EECC); Commission Delegated Regulation (EU) 2023/444',
    articles: 'Article 109',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['communication', 'road', 'office', 'maritime', 'mountain'],
  },
  {
    id: 'handset_location',
    title: 'Your phone must be able to provide Wi-Fi and satellite location for emergencies',
    summary:
      'Handheld mobile telephones must support Wi-Fi and GNSS location compatible with Galileo for emergency communications.',
    detail:
      'This requirement under the Radio Equipment Directive significantly improves location accuracy for emergency calls. It is the reason ResQKit does not need to transmit your position to the emergency service itself — the handset and network deliver caller location under this framework.',
    instrument: 'Directive 2014/53/EU (RED); Commission Delegated Regulation (EU) 2019/320',
    articles: 'Essential requirements for handheld mobile telephones',
    jurisdiction: 'EU',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['communication'],
  },
  {
    id: 'gdpr_vital',
    title: 'Helping an injured person is lawful without their consent',
    summary:
      'Processing personal data to protect vital interests has its own legal basis; health data at a scene relies on the vital-interests condition where the person cannot consent.',
    detail:
      'A legal basis is essential even in emergencies. Article 6(1)(d) covers vital interests and 6(1)(e) public interest. For special categories such as health data, Article 9(2) conditions apply — including Article 9(2)(c) where the data subject is physically or legally incapable of giving consent. ResQKit records which basis applies per field rather than assuming one basis for everything.',
    instrument: 'Regulation (EU) 2016/679 (GDPR)',
    articles: 'Art. 6(1)(d), Art. 6(1)(e), Art. 9(2)(a), Art. 9(2)(c)',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy'],
  },
  {
    id: 'gdpr_minimisation',
    title: 'Only collect what the rescuer actually needs',
    summary:
      'Data must be adequate, relevant and limited to what is necessary, collected for specified purposes, and kept no longer than necessary.',
    detail:
      'Purpose limitation means emergency data must not be reused for incompatible purposes such as marketing. Storage limitation is why ResQKit deletes the incident record when the incident is closed unless you explicitly choose to keep it.',
    instrument: 'Regulation (EU) 2016/679 (GDPR)',
    articles: 'Art. 5(1)(b), Art. 5(1)(c), Art. 5(1)(e)',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy'],
  },
  {
    id: 'gdpr_by_design',
    title: 'Privacy by design, security, and impact assessment',
    summary:
      'Controllers must build in data protection by design and by default, secure the data, and run a DPIA for high-risk processing.',
    detail:
      'Recommended measures include pseudonymisation and encryption, secure processing environments, access controls and logging. ResQKit processes on-device by default and treats a full Data Protection Impact Assessment as a pre-launch gate because it handles special-category data in high-risk contexts.',
    instrument: 'Regulation (EU) 2016/679 (GDPR)',
    articles: 'Art. 25, Art. 32, Art. 35, Art. 37',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy'],
  },
  {
    id: 'gdpr_rights',
    title: 'Your rights over the data in this app',
    summary: 'Access, rectification, erasure and restriction of processing are enforceable rights.',
    detail:
      'ResQKit implements these directly: you can review the incident record, correct your Safety Profile, withdraw consent, and delete everything from inside the app without contacting anyone.',
    instrument: 'Regulation (EU) 2016/679 (GDPR)',
    articles: 'Arts. 15–18',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy'],
  },
  {
    id: 'ehds',
    title: 'European Health Data Space — health data interoperability',
    summary:
      'The EHDS entered into force on 26 March 2025 with phased implementation through 2031 and mandates common standards such as HL7 FHIR.',
    detail:
      'It empowers individuals to access, control and share electronic health data across borders for care delivery, and governs secure reuse for research and policy. Secondary use is limited to specified purposes and explicitly prohibits marketing or decisions detrimental to individuals. MyHealth@EU supports cross-border transmission of patient summaries under GDPR and national law. ResQKit defers EHDS/FHIR exchange to a later release.',
    instrument: 'Regulation (EU) 2025/327 (EHDS)',
    articles: 'Primary and secondary use; interoperability obligations',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy', 'health'],
  },
  {
    id: 'nis2_cer',
    title: 'Emergency communications are critical infrastructure',
    summary:
      'PSAPs, communication networks and supporting ICT infrastructure fall under EU cybersecurity and resilience obligations.',
    detail:
      'The NIS2 Directive strengthens cybersecurity across the Union and the Critical Entities Resilience Directive addresses the resilience of critical entities to a range of threats. This is why an assisting app must not become a weak link in the emergency chain — ResQKit keeps camera frames on-device and never uploads scene imagery.',
    instrument: 'NIS2 Directive; Critical Entities Resilience (CER) Directive',
    articles: 'Critical infrastructure scope',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['security'],
  },
  {
    id: 'civil_protection',
    title: 'EU Civil Protection Mechanism',
    summary: 'Provides emergency support in response to exceptional crises or disasters within Member States.',
    detail:
      'It coordinates assistance and uses the Common Emergency Communication and Information System (CECIS) for real-time information exchange between participating states.',
    instrument: 'EU Civil Protection Mechanism',
    articles: 'Coordination and CECIS information exchange',
    jurisdiction: 'EU / Romania',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['coordination'],
  },
  {
    id: 'transfers',
    title: 'Sending personal data outside the EU requires safeguards',
    summary:
      'Transfers rely on adequacy decisions, Standard Contractual Clauses, Binding Corporate Rules or narrow Article 49 derogations.',
    detail:
      'After the Schrems II judgment, use of SCCs requires assessing whether third-country law prevents the importer from complying, via a Transfer Impact Assessment, with supplementary measures such as encryption or pseudonymisation where needed. Because the ResQKit MVP uploads nothing, this machinery is not engaged in release 1 — it becomes mandatory analysis the moment a cloud component is introduced.',
    instrument: 'Regulation (EU) 2016/679 (GDPR)',
    articles: 'Chapter V, Arts. 44–50 (esp. Art. 45, Art. 46, Art. 49)',
    jurisdiction: 'EU',
    sourceDoc: 'EU_REG',
    lastVerified: '2026-08-12',
    tags: ['privacy'],
  },
];

/**
 * Jurisdictions and topics for which this content pack has NO verified
 * source yet. The UI renders this as an explicit empty state instead of
 * generating plausible-sounding text.
 */
export const PENDING_VERIFICATION: { topic: string; note: string }[] = [
  {
    topic: 'Romanian national implementing rules',
    note:
      'The research baseline establishes that alignment with Romanian national rules and interpretations for emergency and medical assistance applications is required, but no verified article-level Romanian source has been added to this content pack yet. Nothing is shown rather than an inference.',
  },
  {
    topic: 'Mandatory kit contents by country',
    note:
      'Statutory minimum contents for vehicle, workplace, maritime and mountain kits are country-specific and not yet verified in this pack. Kit contents in the app are descriptive, not a legal compliance checklist.',
  },
  {
    topic: 'Duty-to-assist and reporting duties',
    note:
      'Any duty to assist, duty to report, or protection-from-liability provision must be cited from primary national law before it appears here.',
  },
];

/**
 * What rescuers prioritise on arrival. Drives the handoff card order.
 * Source: RESP.
 */
export const RESPONDER_PRIORITIES = [
  'Exact location',
  'Number of victims',
  'Type of injury and severity',
  'Specific hazards on scene',
  'Victim medical history, allergies and medications',
  'What has already been done, and when',
];