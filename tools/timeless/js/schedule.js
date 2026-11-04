/**
 * TimeLess - schedule.js
 * 週間スケジュール (7×24) データ管理・操作・集計
 */

export const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];
export const DAY_NAMES_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const TIME_BLOCKS = {
  morning: { label: '朝', range: [6, 12], hours: [6, 7, 8, 9, 10, 11] },
  afternoon: { label: '昼', range: [12, 18], hours: [12, 13, 14, 15, 16, 17] },
  night: { label: '夜', range: [18, 24], hours: [18, 19, 20, 21, 22, 23] },
  midnight: { label: '深夜', range: [0, 6], hours: [0, 1, 2, 3, 4, 5] }
};

export class ScheduleManager {
  constructor(initialData = null) {
    this.copiedDayBuffer = null;
    if (initialData && Array.isArray(initialData) && initialData.length === 7) {
      this.grid = initialData.map(d => [...d]);
    } else {
      this.grid = Array.from({ length: 7 }, () => Array(24).fill(false));
    }
  }

  getGrid() {
    return this.grid;
  }

  setGrid(newGrid) {
    this.grid = newGrid.map(d => [...d]);
  }

  getCell(day, hour) {
    if (day < 0 || day > 6 || hour < 0 || hour > 23) return false;
    return this.grid[day][hour];
  }

  setCell(day, hour, val) {
    if (day < 0 || day > 6 || hour < 0 || hour > 23) return;
    this.grid[day][hour] = Boolean(val);
  }

  toggleCell(day, hour) {
    if (day < 0 || day > 6 || hour < 0 || hour > 23) return false;
    this.grid[day][hour] = !this.grid[day][hour];
    return this.grid[day][hour];
  }

  // 1日単位の操作
  setDayAll(day, val) {
    if (day < 0 || day > 6) return;
    this.grid[day].fill(Boolean(val));
  }

  // 平日 (月〜金: 0..4) 一括
  setWeekdays(val) {
    for (let d = 0; d <= 4; d++) {
      this.grid[d].fill(Boolean(val));
    }
  }

  // 休日 (土・日: 5..6) 一括
  setWeekends(val) {
    for (let d = 5; d <= 6; d++) {
      this.grid[d].fill(Boolean(val));
    }
  }

  // 全選択・全解除
  setAll(val) {
    for (let d = 0; d < 7; d++) {
      this.grid[d].fill(Boolean(val));
    }
  }

  // 時間帯一括設定 (朝・昼・夜・深夜) を指定曜日に適用
  applyTimeBlock(blockKey, targetDays, val = true) {
    const block = TIME_BLOCKS[blockKey];
    if (!block) return;
    targetDays.forEach(d => {
      if (d >= 0 && d < 7) {
        block.hours.forEach(h => {
          this.grid[d][h] = Boolean(val);
        });
      }
    });
  }

  // コピー・貼り付け
  copyDay(day) {
    if (day < 0 || day > 6) return false;
    this.copiedDayBuffer = [...this.grid[day]];
    return true;
  }

  pasteDay(targetDay) {
    if (!this.copiedDayBuffer || targetDay < 0 || targetDay > 6) return false;
    this.grid[targetDay] = [...this.copiedDayBuffer];
    return true;
  }

  hasCopiedDay() {
    return this.copiedDayBuffer !== null;
  }

  // テンプレート適用
  applyTemplate(templateId) {
    const newGrid = Array.from({ length: 7 }, () => Array(24).fill(false));

    switch (templateId) {
      case 'weekday_night':
        // 平日夜型: 月〜金 19:00〜24:00, 土日 13:00〜24:00
        for (let d = 0; d < 5; d++) {
          for (let h = 19; h < 24; h++) newGrid[d][h] = true;
        }
        for (let d = 5; d < 7; d++) {
          for (let h = 13; h < 24; h++) newGrid[d][h] = true;
        }
        break;

      case 'weekend_focus':
        // 休日中心: 金 20:00〜24:00, 土日 10:00〜24:00
        for (let h = 20; h < 24; h++) newGrid[4][h] = true;
        for (let d = 5; d < 7; d++) {
          for (let h = 10; h < 24; h++) newGrid[d][h] = true;
        }
        break;

      case 'late_night':
        // 深夜型: 毎日 22:00〜翌4:00 (22,23,0,1,2,3)
        for (let d = 0; d < 7; d++) {
          [22, 23, 0, 1, 2, 3].forEach(h => { newGrid[d][h] = true; });
        }
        break;

      case 'daily_free':
        // 毎日自由設定: 毎日 13:00〜17:00, 20:00〜24:00
        for (let d = 0; d < 7; d++) {
          for (let h = 13; h < 17; h++) newGrid[d][h] = true;
          for (let h = 20; h < 24; h++) newGrid[d][h] = true;
        }
        break;

      case 'clear':
        // 全クリア
        break;

      default:
        return false;
    }

    this.grid = newGrid;
    return true;
  }

  // 統計集計
  getTotalHours() {
    return this.grid.reduce((acc, dayArr) => acc + dayArr.filter(Boolean).length, 0);
  }

  getDayHours(day) {
    if (day < 0 || day > 6) return 0;
    return this.grid[day].filter(Boolean).length;
  }

  getWeekdayHours() {
    let sum = 0;
    for (let d = 0; d <= 4; d++) sum += this.getDayHours(d);
    return sum;
  }

  getWeekendHours() {
    return this.getDayHours(5) + this.getDayHours(6);
  }

  getAverageWeekdayHours() {
    return (this.getWeekdayHours() / 5).toFixed(1);
  }

  getAverageWeekendHours() {
    return (this.getWeekendHours() / 2).toFixed(1);
  }

  getPeakDay() {
    let max = -1;
    let peakDayIdx = 0;
    for (let d = 0; d < 7; d++) {
      const h = this.getDayHours(d);
      if (h > max) {
        max = h;
        peakDayIdx = d;
      }
    }
    return {
      index: peakDayIdx,
      name: DAY_NAMES[peakDayIdx],
      nameEn: DAY_NAMES_EN[peakDayIdx],
      hours: max
    };
  }

  getPeakHourRange() {
    // 時間帯ごとの全曜日合算 (0..23)
    const hourCounts = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      for (let d = 0; d < 7; d++) {
        if (this.grid[d][h]) hourCounts[h]++;
      }
    }

    let maxCount = 0;
    let peakHour = 20; // fallback
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > maxCount) {
        maxCount = hourCounts[h];
        peakHour = h;
      }
    }

    const nextH = (peakHour + 1) % 24;
    const nextHLabel = nextH === 0 ? '24:00' : `${nextH}:00`;

    return {
      hour: peakHour,
      label: `${peakHour}:00〜${nextHLabel}`,
      count: maxCount,
      allEmpty: maxCount === 0
    };
  }

  /**
   * 平日または休日の各時間（0〜23時）における対戦可能日数の割合を計算
   * @param {number[]} dayIndices - 対象の曜日インデックス配列 (例: [0,1,2,3,4] または [5,6])
   * @returns {Array<{ hour: number, activeDays: number, totalDays: number, ratio: number }>}
   */
  getHourlyRatios(dayIndices) {
    const totalDays = dayIndices.length;
    const result = [];

    for (let h = 0; h < 24; h++) {
      let activeDays = 0;
      for (const d of dayIndices) {
        if (this.grid[d][h]) {
          activeDays++;
        }
      }
      result.push({
        hour: h,
        activeDays,
        totalDays,
        ratio: totalDays > 0 ? activeDays / totalDays : 0
      });
    }

    return result;
  }
}

