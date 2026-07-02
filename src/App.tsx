import React, { useState, useMemo } from 'react';
import { Upload, Printer, User, Clock, BookOpen, RefreshCw } from 'lucide-react';
import { parseExcelData } from './parser';
import type { ParsedData } from './parser';
import './index.css';

function App() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeacherCode, setSelectedTeacherCode] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      const parsed = await parseExcelData(file);
      setData(parsed);
      // Select first teacher by default if available
      if (parsed.teachers.length > 0) {
        setSelectedTeacherCode(parsed.teachers[0].kode_guru);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal membaca file Excel. Pastikan format sesuai.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetData = () => {
    setData(null);
    setSelectedTeacherCode('');
  };

  const currentTeacher = useMemo(() => {
    if (!data || !selectedTeacherCode) return null;
    return data.teachers.find(t => t.kode_guru === selectedTeacherCode) || null;
  }, [data, selectedTeacherCode]);

  const scheduleGrid = useMemo(() => {
    if (!data || !selectedTeacherCode) return null;
    const slots = data.scheduleData[selectedTeacherCode] || [];
    
    // Create a 10x5 grid (Periods 1-10, Days: Senin-Jumat)
    const grid: { [period: number]: { [day: string]: { kelas: string, mapel: string } | null } } = {};
    for (let p = 1; p <= 10; p++) {
      grid[p] = { 'SENIN': null, 'SELASA': null, 'RABU': null, 'KAMIS': null, "JUM'AT": null };
    }

    slots.forEach(slot => {
      if (grid[slot.period] && grid[slot.period][slot.day] !== undefined) {
        grid[slot.period][slot.day] = { kelas: slot.kelas, mapel: slot.mapel };
      }
    });

    return grid;
  }, [data, selectedTeacherCode]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Sistem Cetak Jadwal Mengajar</h1>
        <p>SMK 45 SURABAYA- Tahun Pelajaran 2026/2027</p>
      </header>

      <main className="main-content">
        {!data ? (
          <div className="upload-card">
            <Upload size={64} className="upload-icon" />
            <h2>Upload File Jadwal Excel</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Pilih file Book1.xlsx yang berisi sheet roster dan daftar guru.
            </p>
            {error && (
              <div style={{ color: '#dc2626', marginTop: '1rem', background: '#fee2e2', padding: '0.75rem', borderRadius: '0.5rem' }}>
                {error}
              </div>
            )}
            <div className="file-input-wrapper">
              <button className="btn-primary" disabled={loading}>
                {loading ? 'Memproses...' : 'Pilih File Excel'}
              </button>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </div>
          </div>
        ) : (
          <div className="dashboard">
            <div className="controls-section">
              <div className="select-wrapper">
                <label htmlFor="teacher-select">Pilih Guru / Kode Guru:</label>
                <select
                  id="teacher-select"
                  className="teacher-select"
                  value={selectedTeacherCode}
                  onChange={(e) => setSelectedTeacherCode(e.target.value)}
                >
                  {data.teachers.map((t, i) => (
                    <option key={i} value={t.kode_guru}>
                      [{t.kode_guru}] {t.nama}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" onClick={resetData}>
                  <RefreshCw size={18} /> Ganti File
                </button>
                <button className="btn-primary" onClick={handlePrint}>
                  <Printer size={18} /> Cetak Jadwal
                </button>
              </div>
            </div>

            {currentTeacher && (
              <>
                <div className="teacher-info-card" id="print-header">
                  <div className="info-item">
                    <h3><User size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> Nama Guru</h3>
                    <p>{currentTeacher.nama}</p>
                  </div>
                  <div className="info-item">
                    <h3>Kode Guru</h3>
                    <p>{currentTeacher.kode_guru}</p>
                  </div>
                  <div className="info-item">
                    <h3><BookOpen size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> Mata Pelajaran</h3>
                    <p>{currentTeacher.kode_mapel || '-'}</p>
                  </div>
                  <div className="info-item">
                    <h3><Clock size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> Jumlah Jam</h3>
                    <p>{currentTeacher.jumlah_jam || '0 Jam'}</p>
                  </div>
                </div>

                <div className="schedule-container">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th className="period-col">Jam Ke</th>
                        <th className="time-col">Waktu</th>
                        <th>Senin</th>
                        <th>Selasa</th>
                        <th>Rabu</th>
                        <th>Kamis</th>
                        <th>Jum'at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const timeMap: Record<number, string> = {
                          1: '07.00 - 07.30',
                          2: '07.30 - 08.00',
                          3: '08.00 - 08.30',
                          4: '08.30 - 09.00',
                          5: '09.30 - 10.00',
                          6: '10.00 - 10.30',
                          7: '10.30 - 11.00',
                          8: '11.00 - 11.30',
                          9: '11.30 - 12.00',
                          10: '12.00 - 12.30'
                        };

                        const rows = [];
                        for (let period = 1; period <= 10; period++) {
                          // Insert break time row after 4th period
                          if (period === 5) {
                            rows.push(
                              <tr key="istirahat" className="break-row">
                                <td colSpan={2} style={{ fontWeight: 'bold' }}>09.00 - 09.30</td>
                                <td colSpan={5} style={{ fontWeight: 'bold', letterSpacing: '4px' }}>ISTIRAHAT</td>
                              </tr>
                            );
                          }

                          rows.push(
                            <tr key={period}>
                              <td className="period-col">{period}</td>
                              <td className="time-col">{timeMap[period]}</td>
                              {['SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT"].map(day => {
                                const slot = scheduleGrid ? scheduleGrid[period][day] : null;
                                if (day === "JUM'AT" && period > 6) {
                                  return <td key={day} style={{ backgroundColor: '#f1f5f9' }}></td>;
                                }
                                return (
                                  <td key={day} className={slot ? 'slot-active' : ''}>
                                    {slot ? (
                                      <>
                                        <div className="slot-kelas">{slot.kelas}</div>
                                        <div className="slot-mapel">{slot.mapel}</div>
                                      </>
                                    ) : (
                                      <span style={{ color: '#cbd5e1' }}>-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="signature-section">
                  <div className="sig-box">
                    <p>Mengetahui</p>
                    <p>Kepala Sekolah</p>
                    <div className="sig-space"></div>
                    <p className="sig-name">DIDIK SUYANDI, S.Pd</p>
                  </div>
                  <div className="sig-box">
                    <p>&nbsp;</p>
                    <p>Guru Yang Bersangkutan</p>
                    <div className="sig-space"></div>
                    <p className="sig-name">{currentTeacher.nama}</p>
                  </div>
                  <div className="sig-box">
                    <p>Surabaya, &nbsp;&nbsp;&nbsp;&nbsp;Juli 2025</p>
                    <p>Waka Kurikulum</p>
                    <div className="sig-space"></div>
                    <p className="sig-name">LUTFY OCTARI, ST, M.Si</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
