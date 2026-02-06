export interface Instance {
  fileKey: string;
  sopInstanceUID: string;
  instanceNumber: number;
  file: File;
}

export interface Series {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  instances: Instance[];
}

export interface Study {
  studyInstanceUID: string;
  studyDate: string;
  studyDescription: string;
  patientName: string;
  patientID: string;
  series: Series[];
}

export interface StudyTree {
  studies: Study[];
}
