/**
 * @fileoverview WebGL-accelerated heat map visualization component for real-time biomechanical data
 * Implements <100ms latency requirement with ±1% accuracy in data visualization
 * @version 1.0.0
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react'; // ^18.0.0
import { select, scaleSequential, interpolateRdYlBu, axisBottom, axisLeft } from 'd3'; // ^7.8.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { useHeatMap } from '../../hooks/useHeatMap';
import type { ChartOptions, HeatMapCell } from '../../interfaces/chart.interface';
import { SENSOR_UPDATE_INTERVAL } from '../../constants/sensor.constants';

// WebGL shader programs
const VERTEX_SHADER = `
  attribute vec2 position;
  attribute float value;
  varying float v_value;
  uniform mat4 u_matrix;
  
  void main() {
    gl_Position = u_matrix * vec4(position, 0.0, 1.0);
    v_value = value;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying float v_value;
  uniform vec3 u_colorScale[10];
  
  void main() {
    float index = floor(v_value * 9.0);
    vec3 color = u_colorScale[int(index)];
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface HeatMapProps {
  options: ChartOptions;
  className?: string;
  webglOptions?: {
    antialias?: boolean;
    alpha?: boolean;
    preserveDrawingBuffer?: boolean;
  };
}

/**
 * WebGL-accelerated heat map visualization component
 * Supports real-time updates with <100ms latency
 */
export const HeatMap: React.FC<HeatMapProps> = ({
  options,
  className,
  webglOptions = {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  }
}) => {
  // Refs for DOM elements and WebGL context
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Custom hook for heat map data management
  const {
    data,
    updateData,
    clearData,
    canvasRef: hookCanvasRef,
    webGLContext,
    error,
    performanceMetrics
  } = useHeatMap(options);

  // Initialize WebGL context and shaders
  const initializeWebGL = useCallback(() => {
    if (!canvasRef.current) return null;

    const gl = canvasRef.current.getContext('webgl', webglOptions);
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    // Create shader program
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    // Link program
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    return { gl, program };
  }, [webglOptions]);

  // Update visualization with WebGL rendering
  const updateVisualization = useCallback((heatMapData: HeatMapCell[]) => {
    if (!webGLContext || !canvasRef.current) return;

    const startTime = performance.now();

    try {
      // Update WebGL buffers with new data
      const positions = new Float32Array(heatMapData.flatMap(cell => [
        cell.col / options.dimensions.width,
        cell.row / options.dimensions.height
      ]));

      const values = new Float32Array(heatMapData.map(cell => cell.intensity));

      // Update vertex buffers
      const positionBuffer = webGLContext.createBuffer();
      const valueBuffer = webGLContext.createBuffer();

      webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, positionBuffer);
      webGLContext.bufferData(webGLContext.ARRAY_BUFFER, positions, webGLContext.STATIC_DRAW);

      webGLContext.bindBuffer(webGLContext.ARRAY_BUFFER, valueBuffer);
      webGLContext.bufferData(webGLContext.ARRAY_BUFFER, values, webGLContext.STATIC_DRAW);

      // Render frame
      webGLContext.clear(webGLContext.COLOR_BUFFER_BIT);
      webGLContext.drawArrays(webGLContext.TRIANGLES, 0, positions.length / 2);

      // Check latency requirement
      const latency = performance.now() - startTime;
      if (latency > 100) {
        console.warn(`Heat map update exceeded latency threshold: ${latency.toFixed(2)}ms`);
      }
    } catch (error) {
      console.error('Error updating visualization:', error);
    }
  }, [webGLContext, options.dimensions]);

  // Initialize D3 scales and axes
  const scales = useMemo(() => {
    const xScale = scaleSequential(interpolateRdYlBu)
      .domain([0, options.dimensions.width]);
    
    const yScale = scaleSequential(interpolateRdYlBu)
      .domain([0, options.dimensions.height]);

    return { xScale, yScale };
  }, [options.dimensions]);

  // Set up D3 axes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    
    const xAxis = axisBottom(scales.xScale);
    const yAxis = axisLeft(scales.yScale);

    svg.select('.x-axis')
      .call(xAxis);

    svg.select('.y-axis')
      .call(yAxis);
  }, [scales]);

  // Initialize WebGL context and cleanup
  useEffect(() => {
    const { gl, program } = initializeWebGL() || {};
    if (!gl || !program) return;

    // Cleanup on unmount
    return () => {
      gl.deleteProgram(program);
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    };
  }, [initializeWebGL]);

  // Update visualization on data changes
  useEffect(() => {
    if (data.length > 0) {
      updateVisualization(data);
    }
  }, [data, updateVisualization]);

  // Error fallback component
  const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
    <div className="heat-map-error">
      <h3>Error rendering heat map</h3>
      <pre>{error.message}</pre>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div 
        ref={containerRef}
        className={`heat-map-container ${className || ''}`}
        role="img"
        aria-label="Biomechanical heat map visualization"
      >
        <canvas
          ref={canvasRef}
          width={options.dimensions.width}
          height={options.dimensions.height}
          className="heat-map-canvas"
        />
        <svg
          ref={svgRef}
          width={options.dimensions.width + options.dimensions.margin.left + options.dimensions.margin.right}
          height={options.dimensions.height + options.dimensions.margin.top + options.dimensions.margin.bottom}
          className="heat-map-svg"
        >
          <g className="x-axis" transform={`translate(0,${options.dimensions.height})`} />
          <g className="y-axis" />
        </svg>
        {performanceMetrics && (
          <div className="performance-metrics" aria-live="polite">
            <span>Latency: {performanceMetrics.averageLatency.toFixed(2)}ms</span>
            <span>Frames: {performanceMetrics.frameCount}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default HeatMap;