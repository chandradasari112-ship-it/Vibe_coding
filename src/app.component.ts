import { Component, ChangeDetectionStrategy, signal, computed, effect, afterNextRender } from '@angular/core';

// To inform TypeScript about the global jsPDF variable from the CDN
declare var jspdf: any;

interface CalculationResult {
  principal: number;
  rate: number;
  time: number;
  timeUnit: 'years' | 'months';
  compoundFrequency: number;
  simpleInterest: number;
  compoundDetail: { interest: number; total: number; };
  totalSimple: number;
  timestamp: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // --- Input Signals ---
  principal = signal<number | null>(10000);
  rate = signal<number | null>(5);
  time = signal<number | null>(10);
  timeUnit = signal<'years' | 'months'>('years');
  compoundFrequency = signal<number>(1); // 0: Simple, 1: Annually, 4: Quarterly, 12: Monthly

  // --- UI State Signals ---
  isLoading = signal(false);
  activeTooltip = signal<string | null>(null);
  
  // --- Result and History Signals ---
  calculationResult = signal<CalculationResult | null>(null);
  calculationHistory = signal<CalculationResult[]>([]);

  tooltipContent = computed(() => {
    switch (this.activeTooltip()) {
      case 'principal':
        return 'Principal is the initial amount of money you borrow or invest.';
      case 'rate':
        return 'The annual interest rate is the percentage of the principal charged per year.';
      case 'time':
        return 'This is the duration for which the money is borrowed or invested.';
      case 'compounding':
        return 'Compounding frequency is how often the interest is calculated and added to the principal. "Simple" interest is not compounded.';
      default:
        return null;
    }
  });

  constructor() {
    afterNextRender(() => {
      this.loadHistoryFromStorage();
    });
    
    // Effect to save history to localStorage whenever it changes
    effect(() => {
      try {
        localStorage.setItem('interestCalcHistory', JSON.stringify(this.calculationHistory()));
      } catch (e) {
        console.error('Could not save history to localStorage', e);
      }
    });
  }
  
  loadHistoryFromStorage() {
    try {
      const storedHistory = localStorage.getItem('interestCalcHistory');
      if (storedHistory) {
        this.calculationHistory.set(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error('Could not load history from localStorage', e);
      this.calculationHistory.set([]);
    }
  }

  onPrincipalChange(event: Event) {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.principal.set(isNaN(value) ? null : value);
  }

  onRateChange(event: Event) {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.rate.set(isNaN(value) ? null : value);
  }

  onTimeChange(event: Event) {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.time.set(isNaN(value) ? null : value);
  }

  onFrequencyChange(event: Event) {
    this.compoundFrequency.set(Number((event.target as HTMLSelectElement).value));
  }
  
  toggleTimeUnit() {
    this.timeUnit.update(unit => (unit === 'years' ? 'months' : 'years'));
  }

  calculate() {
    const p = this.principal();
    const r = this.rate();
    const t = this.time();
    const n = this.compoundFrequency();

    if (p === null || r === null || t === null || p <= 0 || r <= 0 || t <= 0) {
      return;
    }

    this.isLoading.set(true);
    this.calculationResult.set(null);

    setTimeout(() => {
      const timeInYears = this.timeUnit() === 'years' ? t : t / 12;
      const rateDecimal = r / 100;

      // Simple Interest
      const simpleInterest = p * rateDecimal * timeInYears;
      const totalSimple = p + simpleInterest;

      // Compound Interest
      let compoundInterest = 0;
      let totalCompound = totalSimple; // Default to simple if frequency is 'Simple'
      if (n > 0) {
        totalCompound = p * Math.pow(1 + rateDecimal / n, n * timeInYears);
        compoundInterest = totalCompound - p;
      } else {
        // For 'Simple' interest option, compound interest is conceptually zero
        compoundInterest = 0;
        totalCompound = p + simpleInterest;
      }
      
      const result: CalculationResult = {
        principal: p,
        rate: r,
        time: t,
        timeUnit: this.timeUnit(),
        compoundFrequency: n,
        simpleInterest: simpleInterest,
        compoundDetail: { interest: compoundInterest, total: totalCompound },
        totalSimple: totalSimple,
        timestamp: Date.now()
      };

      this.calculationResult.set(result);
      this.isLoading.set(false);
      
      // Save to history automatically
      this.saveToHistory(result);
    }, 1000); // Simulate calculation time
  }
  
  saveToHistory(result: CalculationResult) {
    this.calculationHistory.update(history => [result, ...history.slice(0, 9)]); // Keep last 10
  }

  reset() {
    this.principal.set(10000);
    this.rate.set(5);
    this.time.set(10);
    this.timeUnit.set('years');
    this.compoundFrequency.set(1);
    this.calculationResult.set(null);
    this.activeTooltip.set(null);
  }

  clearHistory() {
    this.calculationHistory.set([]);
  }

  showTooltip(field: string) {
    this.activeTooltip.set(field);
  }

  hideTooltip() {
    this.activeTooltip.set(null);
  }

  exportToPdf() {
    const result = this.calculationResult();
    if (!result) return;

    try {
      const { jsPDF } = jspdf;
      const doc = new jsPDF();
      const formatCurrency = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
      
      doc.setFontSize(22);
      doc.text("Interest Calculation Report", 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date(result.timestamp).toLocaleString()}`, 105, 30, { align: 'center' });

      doc.line(20, 35, 190, 35);

      doc.setFontSize(16);
      doc.text("Inputs", 20, 45);
      doc.setFontSize(12);
      doc.text(`Principal Amount: ${formatCurrency(result.principal)}`, 20, 55);
      doc.text(`Annual Rate: ${result.rate}%`, 20, 62);
      doc.text(`Time Period: ${result.time} ${result.timeUnit}`, 20, 69);
      
      doc.line(20, 80, 190, 80);

      doc.setFontSize(16);
      doc.text("Calculation Summary", 20, 90);
      
      doc.setFontSize(14);
      doc.text("Simple Interest", 20, 100);
      doc.setFontSize(12);
      doc.text(`Interest Earned: ${formatCurrency(result.simpleInterest)}`, 25, 107);
      doc.text(`Total Amount: ${formatCurrency(result.totalSimple)}`, 25, 114);

      doc.setFontSize(14);
      doc.text("Compound Interest", 20, 128);
      doc.setFontSize(12);
      const compoundFreqText = this.getFrequencyText(result.compoundFrequency);
      doc.text(`Compounding: ${compoundFreqText}`, 25, 135);
      doc.text(`Interest Earned: ${formatCurrency(result.compoundDetail.interest)}`, 25, 142);
      doc.text(`Total Amount: ${formatCurrency(result.compoundDetail.total)}`, 25, 149);

      doc.save(`Interest_Report_${result.timestamp}.pdf`);
    } catch(e) {
      console.error("Failed to generate PDF:", e);
      alert("There was an error generating the PDF. Please ensure you are connected to the internet.");
    }
  }

  getFrequencyText(n: number): string {
    switch (n) {
      case 0: return 'Simple';
      case 1: return 'Annually';
      case 4: return 'Quarterly';
      case 12: return 'Monthly';
      default: return 'N/A';
    }
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '₹ 0.00';
    return value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
