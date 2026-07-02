import * as XLSX from 'xlsx';

export interface ClassInfo {
  no: number;
  kelas: string;
  wali_kelas: string;
  row_idx: number; // 0-indexed in the sheet
}

export interface TeacherInfo {
  row: number;
  nama: string;
  kode_guru: string;
  kode_mapel: string;
  jumlah_jam: string;
}

export interface ScheduleSlot {
  kelas: string;
  mapel: string;
  day: string;
  period: number;
}

export interface ParsedData {
  classes: ClassInfo[];
  teachers: TeacherInfo[];
  scheduleData: { [kode_guru: string]: ScheduleSlot[] };
}

// Day offsets in Sheet 1 (0-indexed columns)
const DAY_COLS = [
  { name: 'SENIN', start: 4, end: 17, periods: 10 },
  { name: 'SELASA', start: 18, end: 31, periods: 10 },
  { name: 'RABU', start: 32, end: 45, periods: 10 },
  { name: 'KAMIS', start: 46, end: 59, periods: 10 },
  { name: 'JUM\'AT', start: 60, end: 73, periods: 6 },
];

export async function parseExcelData(file: File): Promise<ParsedData> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length < 2) {
    throw new Error('File Excel tidak memiliki jumlah sheet yang cukup (minimal 2).');
  }

  const rosterSheet = workbook.Sheets[sheetNames[0]];
  const teacherSheet = workbook.Sheets[sheetNames[1]];

  const rowsRoster = XLSX.utils.sheet_to_json<any[]>(rosterSheet, { header: 1, defval: '' });
  const rowsTeacher = XLSX.utils.sheet_to_json<any[]>(teacherSheet, { header: 1, defval: '' });

  // 1. Extract Classes
  const classes: ClassInfo[] = [];
  for (let idx = 5; idx < rowsRoster.length; idx++) {
    const row = rowsRoster[idx];
    if (row && row.length > 3) {
      const className = String(row[2]).trim();
      const wali = String(row[3]).trim();
      const no = String(row[0]).trim();
      
      if (className && className.toUpperCase() !== 'KELAS' && !className.startsWith('Row') && /^\d+$/.test(no)) {
        classes.push({
          no: parseInt(no, 10),
          kelas: className,
          wali_kelas: wali,
          row_idx: idx
        });
      }
    }
  }

  // 2. Extract Teachers
  const teachers: TeacherInfo[] = [];
  for (let idx = 0; idx < rowsTeacher.length; idx++) {
    const row = rowsTeacher[idx];
    if (!row) continue;
    
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = String(row[colIdx]).trim().toLowerCase();
      if (cell === 'nama') {
        let nameVal = '';
        for (let k = colIdx + 1; k < Math.min(colIdx + 30, row.length); k++) {
          const val = String(row[k]).trim();
          if (val && val !== ':') {
            nameVal = val;
            break;
          }
        }
        
        let kodeGuru = '';
        let kodeMapel = '';
        let jumlahJam = '';
        
        for (let offset = 1; offset <= 6; offset++) {
          if (idx + offset < rowsTeacher.length) {
            const nextRow = rowsTeacher[idx + offset];
            if (!nextRow) continue;
            
            for (let cIdx = 0; cIdx < nextRow.length; cIdx++) {
              const cClean = String(nextRow[cIdx]).trim().toLowerCase();
              if (cClean === 'kode guru') {
                for (let k = cIdx + 1; k < Math.min(cIdx + 30, nextRow.length); k++) {
                  const val = String(nextRow[k]).trim();
                  if (val && val !== ':') {
                    kodeGuru = val;
                    break;
                  }
                }
              } else if (cClean === 'kode mapel') {
                for (let k = cIdx + 1; k < Math.min(cIdx + 30, nextRow.length); k++) {
                  const val = String(nextRow[k]).trim();
                  if (val && val !== ':') {
                    kodeMapel = val;
                    break;
                  }
                }
              } else if (cClean === 'jumlah jam') {
                for (let k = cIdx + 1; k < Math.min(cIdx + 30, nextRow.length); k++) {
                  const val = String(nextRow[k]).trim();
                  if (val && val !== ':') {
                    jumlahJam = val;
                    break;
                  }
                }
              }
            }
          }
        }
        
        if (nameVal || kodeGuru) {
          teachers.push({
            row: idx + 1,
            nama: nameVal,
            kode_guru: kodeGuru,
            kode_mapel: kodeMapel,
            jumlah_jam: jumlahJam
          });
        }
      }
    }
  }

  // 3. Extract Schedule for each Teacher
  const scheduleData: { [kode_guru: string]: ScheduleSlot[] } = {};
  
  teachers.forEach(t => {
    if (t.kode_guru) {
      scheduleData[t.kode_guru] = [];
    }
  });

  classes.forEach(cls => {
    const mapelRow = rowsRoster[cls.row_idx] || [];
    const teacherRow = rowsRoster[cls.row_idx + 1] || [];
    
    DAY_COLS.forEach(dayInfo => {
      for (let p = 0; p < dayInfo.periods; p++) {
        const colIndex = dayInfo.start + p;
        const mapelCode = String(mapelRow[colIndex] || '').trim();
        const teacherCode = String(teacherRow[colIndex] || '').trim();
        
        if (teacherCode && mapelCode) {
          if (!scheduleData[teacherCode]) {
            scheduleData[teacherCode] = [];
          }
          scheduleData[teacherCode].push({
            kelas: cls.kelas,
            mapel: mapelCode,
            day: dayInfo.name,
            period: p + 1
          });
        }
      }
    });
  });

  return { classes, teachers, scheduleData };
}
