/**
 * Master Data for Vellore District, Samagra Shiksha
 * Synchronized directly with live Supabase Database
 */

export interface BlockMaster {
  id: string;
  code: string;
  name: string;
  bmoName: string;
  email: string;
  totalSchools: number;
}

export interface SchoolMaster {
  udiseCode: string;
  name: string;
  blockId: string;
  blockName: string;
  category: string;
  headmasterName: string;
  phone: string;
  defaultBeneficiaries: number;
}

export const VELLORE_BLOCKS: BlockMaster[] = [
  {
    "id": "330412",
    "code": "330412",
    "name": "ANAICUT",
    "bmoName": "BEO Anaicut",
    "email": "beo.anaicut@tnschools.gov.in",
    "totalSchools": 9
  },
  {
    "id": "330414",
    "code": "330414",
    "name": "K.V.KUPPAM",
    "bmoName": "BEO K.V.Kuppam",
    "email": "beo.kvkuppam@tnschools.gov.in",
    "totalSchools": 13
  },
  {
    "id": "330415",
    "code": "330415",
    "name": "GUDIYATHAM",
    "bmoName": "BEO Gudiyatham",
    "email": "beo.gudiyatham@tnschools.gov.in",
    "totalSchools": 5
  },
  {
    "id": "330411",
    "code": "330411",
    "name": "KANIYAMBADI",
    "bmoName": "BEO Kaniyambadi",
    "email": "beo.kaniyambadi@tnschools.gov.in",
    "totalSchools": 5
  },
  {
    "id": "330409",
    "code": "330409",
    "name": "VELLORE RURAL",
    "bmoName": "BEO Vellore Rural",
    "email": "beo.vellorerural@tnschools.gov.in",
    "totalSchools": 6
  },
  {
    "id": "330416",
    "code": "330416",
    "name": "PERNAMBUT",
    "bmoName": "BEO Pernambut",
    "email": "beo.pernambut@tnschools.gov.in",
    "totalSchools": 5
  }
];

export const VELLORE_SCHOOLS: SchoolMaster[] = [
  {
    "udiseCode": "33041202401",
    "name": "GOVT HS PEENJAMANDAI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041202601",
    "name": "PUMS JARTHANKOLLAI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041204102",
    "name": "PUMS THARVAZHI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041201203",
    "name": "PUPS MELARASAMBUT",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041202503",
    "name": "PUPS NEKKINI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041202402",
    "name": "PUPS PEENJAMANTHAI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041202404",
    "name": "PUPS PERIYAPANAPARAI",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041201704",
    "name": "PUPS VENGANNAPALAYAM",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041701501",
    "name": "PUPS,ASANAMBUT",
    "blockId": "330412",
    "blockName": "ANAICUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041501102",
    "name": "PUMS ERIPATTARAI",
    "blockId": "330415",
    "blockName": "GUDIYATHAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041500204",
    "name": "PUMS UPPARAPALLI",
    "blockId": "330415",
    "blockName": "GUDIYATHAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041503004",
    "name": "PUPS GANDHI NAGAR",
    "blockId": "330415",
    "blockName": "GUDIYATHAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041703001",
    "name": "PUPS,GOLLAMANGALAM.",
    "blockId": "330415",
    "blockName": "GUDIYATHAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041703101",
    "name": "PUPS,PALLIKUPPAM.",
    "blockId": "330415",
    "blockName": "GUDIYATHAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041402501",
    "name": "ADWPS PILLANDIPATTU",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041403703",
    "name": "PUMS B.N.PALAYAM PUDUR",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041404201",
    "name": "PUPS CHINNA LATHERI",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041400503",
    "name": "PUPS CHINNA NAGAL",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041400401",
    "name": "PUPS DEVARISHIKUPPAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041403501",
    "name": "PUPS EDAKRISHNAPURAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041401403",
    "name": "PUPS K.P.KUPPAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041403802",
    "name": "PUPS KALAMPATTU",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041403401",
    "name": "PUPS KOTHAMANGALAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041401501",
    "name": "PUPS MELMONGKUPPAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041400502",
    "name": "PUPS NAGAL, K.V.KUPPAM",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041402303",
    "name": "PUPS NATHAIMEDU",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041401605",
    "name": "PUPS PALLATHUR",
    "blockId": "330414",
    "blockName": "K.V.KUPPAM",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041102704",
    "name": "PUMS KILVALLAM",
    "blockId": "330411",
    "blockName": "KANIYAMBADI",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041100301",
    "name": "PUMS NANJUKONDAPURAM",
    "blockId": "330411",
    "blockName": "KANIYAMBADI",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041102901",
    "name": "PUPS KAMMAVANPETTAI",
    "blockId": "330411",
    "blockName": "KANIYAMBADI",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041102001",
    "name": "PUPS KANIYAMBADI",
    "blockId": "330411",
    "blockName": "KANIYAMBADI",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041102801",
    "name": "PUPS KILPALLIPATTU",
    "blockId": "330411",
    "blockName": "KANIYAMBADI",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041600804",
    "name": "GHS PALLALAKUPPAM",
    "blockId": "330416",
    "blockName": "PERNAMBUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041602405",
    "name": "GHSS MAILPATTI",
    "blockId": "330416",
    "blockName": "PERNAMBUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041600801",
    "name": "PUPS PALLALAKUPPAM",
    "blockId": "330416",
    "blockName": "PERNAMBUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041601501",
    "name": "PUPS PARAVAKKAL",
    "blockId": "330416",
    "blockName": "PERNAMBUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33041601701",
    "name": "PUPS,KARKOOR",
    "blockId": "330416",
    "blockName": "PERNAMBUT",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040902601",
    "name": "ADWPS ALAMELUMANGAPURAM",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040900203",
    "name": "PUMS GURUMALAI",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040900101",
    "name": "PUMS PULIMEDU",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040901805",
    "name": "PUPS Ariyur (H)",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040900405",
    "name": "PUPS GOVINDAREDDYPALAYAM",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  },
  {
    "udiseCode": "33040902702",
    "name": "PUPS SENGANATHAM",
    "blockId": "330409",
    "blockName": "VELLORE RURAL",
    "category": "Government School",
    "headmasterName": "Headmaster",
    "phone": "",
    "defaultBeneficiaries": 0
  }
];

export interface SampleStudentTemplate {
  name: string;
  cat: "Transport" | "Escort";
  grade: string;
  rate: number;
  provider: string;
}

export const SAMPLE_STUDENTS_TEMPLATES: SampleStudentTemplate[] = [];
