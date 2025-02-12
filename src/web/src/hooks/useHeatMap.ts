/**
 * @fileoverview Custom React hook for WebGL-accelerated heat map visualization
 * Implements real-time performance monitoring with <100ms latency and ±1% accuracy
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'; // ^18.0.0
import { scaleSequential, interpolateRdYlBu, select } from 'd3'; // ^7.8.0
import { debounce } from 'lodash'; // ^4.17.21

import { HeatMapData, ChartOptions } from '../interfaces/chart.interface';
import { analyticsService } from '../services/analytics.service';

// WebGL shader programs for hardware acceleration
const VERTEX_SHADER = `
  attribute vec2 position;
  attribute float value;
  varying float v_value;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    v_value = value;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying float v_value;
  uniform vec3 colorScale[10];
  void main() {
    float index = floor(v_value * 9.0);
    vec3 color = colorScale[int(index)];
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Custom hook for managing WebGL-accelerated heat map visualization
 * @param options - Chart configuration options
 */
export const useHeatMap = (options: ChartOptions) => {
  // State management
  const [data, setData] = useState<HeatMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for WebGL context and animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Performance monitoring
  const performanceRef = useRef({
    lastRenderTime: 0,
    frameCount: 0,
    averageLatency: 0
  });

  /**
   * Initialize WebGL context and shaders
   */
  const initializeWebGL = useCallback(() => {
    if (!canvasRef.current) return;

    try {
      const gl = canvasRef.current.getContext('webgl', {
        antialias: true,
        powerPreference: 'high-performance'
      });

      if (!gl) throw new Error('WebGL not supported');

      // Create shader program
      const program = gl.createProgram();
      if (!program) throw new Error('Failed to create shader program');

      // Compile shaders
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!vertexShader || !fragmentShader) throw new Error('Failed to create shaders');

      gl.shaderSource(vertexShader, VERTEX_SHADER);
      gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
      gl.compileShader(vertexShader);
      gl.compileShader(fragmentShader);

      // Link program
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      glRef.current = gl;
      programRef.current = program;
      setIsInitialized(true);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  /**
   * Update heat map data with WebGL rendering
   * Implements ±1% accuracy requirement
   */
  const updateData = useCallback((newData: HeatMapData[]) => {
    if (!isInitialized || !glRef.current || !programRef.current) return;

    const startTime = performance.now();

    try {
      // Validate data accuracy (±1% requirement)
      const validatedData = analyticsService.validateDataAccuracy(newData, 0.01);
      
      // Update state with validated data
      setData(validatedData);

      // Generate heat map data
      const heatMapData = analyticsService.generateHeatMap(validatedData);

      // Update WebGL buffers and render
      const gl = glRef.current;
      const program = programRef.current;

      // Create and bind buffers
      const positionBuffer = gl.createBuffer();
      const valueBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(heatMapData.positions), gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, valueBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(heatMapData.values), gl.STATIC_DRAW);

      // Update attributes
      const positionLocation = gl.getAttribLocation(program, 'position');
      const valueLocation = gl.getAttribLocation(program, 'value');

      gl.enableVertexAttribArray(positionLocation);
      gl.enableVertexAttribArray(valueLocation);

      // Render frame
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, heatMapData.positions.length / 2);

      // Update performance metrics
      const endTime = performance.now();
      const latency = endTime - startTime;
      performanceRef.current.averageLatency = 
        (performanceRef.current.averageLatency * performanceRef.current.frameCount + latency) / 
        (performanceRef.current.frameCount + 1);
      performanceRef.current.frameCount++;

      // Check latency requirement (<100ms)
      if (latency > 100) {
        console.warn(`Heat map update exceeded latency threshold: ${latency.toFixed(2)}ms`);
      }

    } catch (err) {
      setError(err as Error);
    }
  }, [isInitialized]);

  /**
   * Debounced update function for performance optimization
   */
  const debouncedUpdate = useMemo(() => 
    debounce(updateData, options.updateInterval || 100), 
    [updateData, options.updateInterval]
  );

  /**
   * Clear heat map data and WebGL resources
   */
  const clearData = useCallback(() => {
    setData([]);
    if (glRef.current && programRef.current) {
      const gl = glRef.current;
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  /**
   * Initialize WebGL context and cleanup on unmount
   */
  useEffect(() => {
    initializeWebGL();

    return () => {
      if (glRef.current) {
        const gl = glRef.current;
        if (programRef.current) {
          gl.deleteProgram(programRef.current);
        }
        // Clean up WebGL resources
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) loseContext.loseContext();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeWebGL]);

  // Return hook interface
  return {
    data,
    updateData: debouncedUpdate,
    clearData,
    canvasRef,
    webGLContext: glRef.current,
    error,
    performanceMetrics: {
      averageLatency: performanceRef.current.averageLatency,
      frameCount: performanceRef.current.frameCount
    }
  };
};

export type UseHeatMapReturn = ReturnType<typeof useHeatMap>;