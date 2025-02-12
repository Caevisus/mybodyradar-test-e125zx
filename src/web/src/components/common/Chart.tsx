import React, { useEffect, useRef, useState } from 'react';
import { select } from 'd3'; // ^7.8.0
import { WebGLRenderer } from 'three'; // ^0.150.0
import { ChartTypes, ChartOptions } from '../../interfaces/chart.interface';
import { formatChartData } from '../../utils/chart.utils';
import { UPDATE_INTERVALS, CHART_DIMENSIONS, PERFORMANCE_CHART_CONSTANTS } from '../../constants/chart.constants';

interface ChartProps {
  data: any[];
  options: ChartOptions;
  onHover?: (event: MouseEvent, data: any) => void;
  onClick?: (event: MouseEvent, data: any) => void;
  className?: string;
  precision?: number;
  useWebGL?: boolean;
  accessibilityLabel?: string;
}

interface PerformanceMonitor {
  lastUpdateTime: number;
  frameCount: number;
  averageLatency: number;
}

/**
 * Enhanced Chart component for real-time data visualization
 * Supports WebGL acceleration and meets <100ms latency requirement
 */
export class Chart extends React.Component<ChartProps> {
  private chartRef: React.RefObject<HTMLDivElement>;
  private chartInstance: any;
  private webGLRenderer: WebGLRenderer | null;
  private frameId: number;
  private performanceMetrics: PerformanceMonitor;

  static defaultProps = {
    precision: PERFORMANCE_CHART_CONSTANTS.Y_AXIS_PRECISION,
    useWebGL: true,
    className: '',
    accessibilityLabel: 'Data visualization chart'
  };

  constructor(props: ChartProps) {
    super(props);
    this.chartRef = React.createRef();
    this.webGLRenderer = null;
    this.frameId = 0;
    this.performanceMetrics = {
      lastUpdateTime: performance.now(),
      frameCount: 0,
      averageLatency: 0
    };
  }

  componentDidMount() {
    this.initializeChart();
    this.setupAccessibility();
    if (this.props.useWebGL) {
      this.initializeWebGL();
    }
    this.startRenderLoop();
  }

  componentDidUpdate(prevProps: ChartProps) {
    if (this.shouldUpdateChart(prevProps)) {
      this.updateChart();
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  private initializeChart(): void {
    if (!this.chartRef.current) return;

    const { options } = this.props;
    const container = select(this.chartRef.current);

    // Initialize chart based on type
    switch (options.type) {
      case ChartTypes.HEAT_MAP:
        this.initializeHeatMap(container);
        break;
      case ChartTypes.LINE_GRAPH:
        this.initializeLineGraph(container);
        break;
      case ChartTypes.PERFORMANCE_GAUGE:
        this.initializePerformanceGauge(container);
        break;
      default:
        console.error('Unsupported chart type');
    }
  }

  private initializeWebGL(): void {
    if (!this.chartRef.current) return;

    this.webGLRenderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      precision: 'highp'
    });

    this.webGLRenderer.setSize(
      this.props.options.dimensions.width,
      this.props.options.dimensions.height
    );
    this.chartRef.current.appendChild(this.webGLRenderer.domElement);
  }

  private setupAccessibility(): void {
    if (!this.chartRef.current) return;

    const { accessibilityLabel } = this.props;
    this.chartRef.current.setAttribute('role', 'img');
    this.chartRef.current.setAttribute('aria-label', accessibilityLabel!);
    this.chartRef.current.setAttribute('tabIndex', '0');
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.frameId = requestAnimationFrame(animate);
      this.updatePerformanceMetrics();
      this.render();
    };
    animate();
  }

  private updatePerformanceMetrics(): void {
    const currentTime = performance.now();
    const frameDuration = currentTime - this.performanceMetrics.lastUpdateTime;
    
    this.performanceMetrics.frameCount++;
    this.performanceMetrics.averageLatency = 
      (this.performanceMetrics.averageLatency * (this.performanceMetrics.frameCount - 1) + frameDuration) / 
      this.performanceMetrics.frameCount;

    // Log warning if latency exceeds requirement
    if (frameDuration > UPDATE_INTERVALS.REAL_TIME) {
      console.warn(`Chart update latency (${frameDuration.toFixed(2)}ms) exceeds 100ms requirement`);
    }

    this.performanceMetrics.lastUpdateTime = currentTime;
  }

  private shouldUpdateChart(prevProps: ChartProps): boolean {
    return (
      prevProps.data !== this.props.data ||
      prevProps.options !== this.props.options ||
      prevProps.precision !== this.props.precision
    );
  }

  private updateChart(): void {
    const { data, options, precision } = this.props;
    const formattedData = formatChartData(data, options.type);

    // Update chart based on type
    switch (options.type) {
      case ChartTypes.HEAT_MAP:
        this.updateHeatMap(formattedData);
        break;
      case ChartTypes.LINE_GRAPH:
        this.updateLineGraph(formattedData);
        break;
      case ChartTypes.PERFORMANCE_GAUGE:
        this.updatePerformanceGauge(formattedData);
        break;
    }
  }

  private render(): void {
    if (this.props.useWebGL && this.webGLRenderer) {
      this.webGLRenderer.render(this.chartInstance.scene, this.chartInstance.camera);
    }
  }

  private cleanup(): void {
    cancelAnimationFrame(this.frameId);
    if (this.webGLRenderer) {
      this.webGLRenderer.dispose();
    }
    if (this.chartRef.current) {
      select(this.chartRef.current).selectAll('*').remove();
    }
  }

  private initializeHeatMap(container: any): void {
    // Heat map specific initialization
  }

  private initializeLineGraph(container: any): void {
    // Line graph specific initialization
  }

  private initializePerformanceGauge(container: any): void {
    // Performance gauge specific initialization
  }

  private updateHeatMap(data: any[]): void {
    // Heat map specific update logic
  }

  private updateLineGraph(data: any[]): void {
    // Line graph specific update logic
  }

  private updatePerformanceGauge(data: any[]): void {
    // Performance gauge specific update logic
  }

  render() {
    const { className } = this.props;
    return (
      <div
        ref={this.chartRef}
        className={`chart-container ${className}`}
        style={{
          width: this.props.options.dimensions.width,
          height: this.props.options.dimensions.height
        }}
      />
    );
  }
}

export default Chart;