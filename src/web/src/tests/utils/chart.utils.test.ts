import { describe, it, expect, beforeEach, jest } from 'jest';
import { performance } from 'jest-performance-timer'; // ^1.0.0
import {
  createChart,
  updateChartData,
  generateHeatMap,
  formatChartData
} from '../../utils/chart.utils';
import { ChartTypes } from '../../constants/chart.constants';
import type { ChartOptions, ChartDataPoint, HeatMapCell } from '../../interfaces/chart.interface';

describe('Chart Utils', () => {
  let container: HTMLDivElement;
  let mockOptions: ChartOptions;
  let mockData: ChartDataPoint[];
  let mockHeatMapData: HeatMapCell[];

  beforeEach(() => {
    // Setup test DOM environment
    container = document.createElement('div');
    container.id = 'chart-container';
    document.body.appendChild(container);

    // Initialize mock options
    mockOptions = {
      type: ChartTypes.HEAT_MAP,
      dimensions: {
        width: 800,
        height: 400,
        margin: { top: 20, right: 30, bottom: 40, left: 50 },
        aspectRatio: 2,
        responsive: true
      },
      updateInterval: 100,
      precision: 2,
      colorScale: ['#f7fbff', '#2171b5'],
      animationConfig: {
        duration: 150,
        easing: 'ease-out'
      },
      interactionConfig: {
        zoomEnabled: true,
        panEnabled: true,
        tooltipEnabled: true,
        selectionEnabled: true
      }
    };

    // Initialize mock data
    mockData = Array.from({ length: 100 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 10) * 50 + 50,
      value: Math.sin(i / 10) * 50 + 50,
      precision: 2,
      confidence: 0.95,
      timestamp: new Date(),
      anomaly: false
    }));

    // Initialize mock heat map data
    mockHeatMapData = Array.from({ length: 64 }, (_, i) => ({
      row: Math.floor(i / 8),
      col: i % 8,
      value: Math.random() * 100,
      precision: 2,
      intensity: Math.random(),
      timestamp: new Date()
    }));
  });

  describe('createChart', () => {
    it('should create chart with correct configuration', () => {
      const chart = createChart(mockOptions, 'chart-container');
      
      expect(chart).toBeDefined();
      expect(chart.svg).toBeDefined();
      expect(chart.xScale).toBeDefined();
      expect(chart.yScale).toBeDefined();
      expect(chart.options).toEqual(mockOptions);
    });

    it('should throw error for invalid container', () => {
      expect(() => createChart(mockOptions, 'invalid-container'))
        .toThrow('Container #invalid-container not found');
    });

    it('should create chart with correct dimensions', () => {
      const chart = createChart(mockOptions, 'chart-container');
      const svg = container.querySelector('svg');
      
      expect(svg?.getAttribute('width')).toBe('800');
      expect(svg?.getAttribute('height')).toBe('400');
    });
  });

  describe('updateChartData', () => {
    it('should update chart data within 100ms latency requirement', () => {
      const chart = createChart(mockOptions, 'chart-container');
      const startTime = performance.now();
      
      updateChartData(chart, mockData);
      const updateTime = performance.now() - startTime;
      
      expect(updateTime).toBeLessThan(100);
    });

    it('should maintain ±1% data accuracy during updates', () => {
      const chart = createChart(mockOptions, 'chart-container');
      const originalValues = mockData.map(d => d.value);
      
      updateChartData(chart, mockData);
      const updatedElements = container.querySelectorAll('.data-point');
      
      updatedElements.forEach((el, i) => {
        const displayedValue = parseFloat(el.getAttribute('data-value') || '0');
        const expectedValue = originalValues[i];
        const errorMargin = Math.abs((displayedValue - expectedValue) / expectedValue);
        
        expect(errorMargin).toBeLessThanOrEqual(0.01); // 1% error margin
      });
    });
  });

  describe('generateHeatMap', () => {
    it('should generate heat map with correct cell count', () => {
      const heatMap = generateHeatMap(mockHeatMapData, mockOptions);
      const cells = container.querySelectorAll('rect');
      
      expect(cells.length).toBe(mockHeatMapData.length);
    });

    it('should apply correct color intensity mapping', () => {
      const heatMap = generateHeatMap(mockHeatMapData, mockOptions);
      const cells = container.querySelectorAll('rect');
      
      cells.forEach((cell, i) => {
        const intensity = mockHeatMapData[i].intensity;
        const fill = cell.getAttribute('fill');
        expect(fill).toBeDefined();
        expect(fill).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
      });
    });

    it('should handle interactive features correctly', () => {
      const heatMap = generateHeatMap(mockHeatMapData, mockOptions);
      const cell = container.querySelector('rect');
      
      // Test hover effect
      cell?.dispatchEvent(new MouseEvent('mouseover'));
      expect(cell?.getAttribute('opacity')).toBe('1');
      
      cell?.dispatchEvent(new MouseEvent('mouseout'));
      expect(cell?.getAttribute('opacity')).toBe('0.8');
    });
  });

  describe('formatChartData', () => {
    it('should format data with required precision', () => {
      const formattedData = formatChartData(mockData, ChartTypes.HEAT_MAP);
      
      formattedData.forEach(point => {
        // Check precision is maintained to 2 decimal places
        const decimalPlaces = point.value.toString().split('.')[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
        
        // Verify value is within ±1% of original
        const originalPoint = mockData.find(d => d.x === point.x);
        const errorMargin = Math.abs((point.value - originalPoint!.value) / originalPoint!.value);
        expect(errorMargin).toBeLessThanOrEqual(0.01);
      });
    });

    it('should detect and mark anomalies correctly', () => {
      // Create data with known anomaly
      const anomalyData = [...mockData];
      anomalyData[50].value = 1000; // Obvious anomaly
      
      const formattedData = formatChartData(anomalyData, ChartTypes.HEAT_MAP);
      expect(formattedData[50].anomaly).toBe(true);
    });

    it('should handle empty or invalid input data', () => {
      expect(() => formatChartData([], ChartTypes.HEAT_MAP))
        .toThrow('Invalid input data format');
      
      expect(() => formatChartData(null as any, ChartTypes.HEAT_MAP))
        .toThrow('Invalid input data format');
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });
});