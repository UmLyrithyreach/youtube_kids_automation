'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
    radius: number;
    label: string;
    pulse: number;
    col: number;
    row: number;
}

interface ConstellationGridProps {
    showTitle?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export default function ConstellationGrid({
    showTitle = false,
    className = "",
    children,
}: ConstellationGridProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    // Sync theme preference and observe dynamic class changes
    useEffect(() => {
        const updateTheme = () => {
            const hasDarkClass = document.documentElement.classList.contains('dark');
            setIsDarkMode(hasDarkClass);
        };
        updateTheme();

        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => updateTheme();
        mediaQuery.addEventListener('change', handler);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', handler);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) return;

        let animationFrameId: number;
        let width = 0;
        let height = 0;

        // Mouse velocity & inertial tracking
        const mouse = {
            x: -1000,
            y: -1000,
            prevX: -1000,
            prevY: -1000,
            vx: 0,
            vy: 0,
            radius: 220,
        };

        let nodes: Node[] = [];
        let gridCols = 0;
        let gridRows = 0;
        let nodeGrid: (Node | null)[][] = [];

        const handleResize = () => {
            // Cap DPR at 1.5 to guarantee high FPS on high-res displays without GPU thermal throttling
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            initNodes();
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        };

        const initNodes = () => {
            nodes = [];
            // Wider spacing: Separates the grid squares further so it feels airy and expansive
            const spacing = 100;
            gridCols = Math.ceil(width / spacing) + 1;
            gridRows = Math.ceil(height / spacing) + 1;

            nodeGrid = Array.from({ length: gridCols }, () => Array(gridRows).fill(null));

            for (let i = 0; i < gridCols; i++) {
                for (let j = 0; j < gridRows; j++) {
                    const x = i * spacing;
                    const y = j * spacing;
                    const node: Node = {
                        x,
                        y,
                        vx: 0,
                        vy: 0,
                        baseX: x,
                        baseY: y,
                        // Delicate fine pinpoint dots
                        radius: Math.random() * 0.3 + 0.75,
                        label: `${(i * 7).toString(16).toUpperCase()}:${(j * 11).toString(16).toUpperCase()}`,
                        pulse: Math.random() * Math.PI * 2,
                        col: i,
                        row: j,
                    };
                    nodes.push(node);
                    nodeGrid[i][j] = node;
                }
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseleave', handleMouseLeave, { passive: true });

        let lastTime = performance.now();

        const render = (now: number) => {
            if (document.hidden) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            // Normalize dt across high-refresh displays (clamped to avoid shockwave teleporting)
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            // Mouse velocity calculation
            mouse.vx = (mouse.x - mouse.prevX) / (dt * 1000 || 1);
            mouse.vy = (mouse.y - mouse.prevY) / (dt * 1000 || 1);
            mouse.prevX = mouse.x;
            mouse.prevY = mouse.y;

            const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);

            // Antigravity signature colors: Google Blue (#4285F4), Red (#EA4335), Yellow (#FBBC05)
            const bgColor = isDarkMode ? '#030407' : '#ebecee';
            const nodeColor = isDarkMode ? '240, 240, 245' : '48, 50, 60';
            const antigravityBlue = '66, 133, 244';    // #4285F4
            const antigravityRed = '234, 67, 53';     // #EA4335
            const antigravityYellow = '251, 188, 5';  // #FBBC05

            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // Node Physics Engine (Hooke's Law Spring-Mass-Damping system)
            const SPRING_K = 18; // Spring stiffness
            const DAMPING = 0.82; // Velocity resistance

            const mouseRadius = mouse.radius;
            const mouseRadiusSq = mouseRadius * mouseRadius;

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                n.pulse += dt * 3;

                // Mouse distance vectors
                const dx = mouse.x - n.x;
                const dy = mouse.y - n.y;
                const distSq = dx * dx + dy * dy;

                // Dynamic shockwave repulsion based on cursor speed
                if (distSq < mouseRadiusSq && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const power = 1 - dist / mouseRadius;
                    const force = power * (1500 + speed * 150);
                    const angle = Math.atan2(dy, dx);

                    // Impulse force pushing node away from cursor
                    n.vx -= Math.cos(angle) * force * dt;
                    n.vy -= Math.sin(angle) * force * dt;
                }

                // Calculate restoring force back to home anchor point (baseX, baseY)
                const homeDx = n.baseX - n.x;
                const homeDy = n.baseY - n.y;

                n.vx += homeDx * SPRING_K * dt;
                n.vy += homeDy * SPRING_K * dt;

                // Apply Damping
                n.vx *= DAMPING;
                n.vy *= DAMPING;

                // Integrate position
                n.x += n.vx * dt * 60;
                n.y += n.vy * dt * 60;
            }

            // Draw Connections using O(N) Spatial Neighbor Grid.
            // Orthogonal connections ONLY (Horizontal + Vertical) with wider reach matching spacing=100
            const MAX_CONN_DIST = 140;
            const MAX_CONN_DIST_SQ = MAX_CONN_DIST * MAX_CONN_DIST;
            const baseAlphaMult = isDarkMode ? 0.15 : 0.08;

            ctx.lineWidth = 0.5;
            ctx.strokeStyle = `rgba(${nodeColor}, ${baseAlphaMult})`;
            ctx.beginPath();

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                const { col, row } = n;

                // Orthogonal connections only (Right & Down)
                const neighbors: [number, number][] = [
                    [col + 1, row],
                    [col, row + 1],
                ];

                for (let k = 0; k < 2; k++) {
                    const [c, r] = neighbors[k];
                    if (c >= 0 && c < gridCols && r >= 0 && r < gridRows) {
                        const n2 = nodeGrid[c]?.[r];
                        if (!n2) continue;

                        const ndx = n.x - n2.x;
                        const ndy = n.y - n2.y;
                        const distSq = ndx * ndx + ndy * ndy;

                        if (distSq < MAX_CONN_DIST_SQ) {
                            ctx.moveTo(n.x, n.y);
                            ctx.lineTo(n2.x, n2.y);
                        }
                    }
                }
            }
            ctx.stroke();

            // Render Node Points & Interactive Highlights
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                const dx = mouse.x - n.x;
                const dy = mouse.y - n.y;
                const distSq = dx * dx + dy * dy;
                const isNear = distSq < mouseRadiusSq;

                const baseAlpha = isNear ? 0.95 : 0.25 + Math.sin(n.pulse) * 0.1;

                // Antigravity gradient transition: Blue -> Red -> Yellow by distance on the DOTS
                let activeColor = antigravityBlue;
                const currentRadius = isNear
                    ? n.radius * 1.45
                    : n.radius + Math.sin(n.pulse) * 0.15;

                if (isNear) {
                    const ratio = Math.sqrt(distSq) / mouseRadius;
                    activeColor = ratio < 0.35
                        ? antigravityBlue
                        : ratio < 0.70
                        ? antigravityRed
                        : antigravityYellow;

                    ctx.save();
                    ctx.shadowColor = `rgba(${activeColor}, 0.7)`;
                    ctx.shadowBlur = 4;
                    ctx.fillStyle = `rgba(${activeColor}, ${baseAlpha})`;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, Math.max(0.9, currentRadius), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                } else {
                    ctx.fillStyle = `rgba(${nodeColor}, ${baseAlpha})`;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, Math.max(0.6, currentRadius), 0, Math.PI * 2);
                    ctx.fill();
                }

                // High-tech Spatial Radar Rings on closest active node (< 70px)
                if (distSq < 4900) {
                    const dist = Math.sqrt(distSq);
                    if (dist < 70) {
                        const pulseRing = ((n.pulse * 18) % 24) + 3;
                        const ringAlpha = (1 - pulseRing / 28) * 0.5;

                        // Antigravity Blue primary pulse
                        ctx.strokeStyle = `rgba(${antigravityBlue}, ${ringAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(n.x, n.y, pulseRing, 0, Math.PI * 2);
                        ctx.stroke();

                        // Hex Coordinate Readout in Antigravity Yellow
                        ctx.font = '8px ui-monospace, SFMono-Regular, Consolas, monospace';
                        ctx.fillStyle = `rgba(${antigravityYellow}, 0.95)`;
                        ctx.fillText(n.label, n.x + 8, n.y - 8);
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [isDarkMode]);

    return (
        <div className={`overflow-hidden select-none ${className}`}>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full block pointer-events-none" />

            {showTitle && (
                <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-4 pointer-events-none mix-blend-difference text-white">
                    <h1 className="font-mono text-6xl md:text-9xl font-black tracking-tighter uppercase leading-none">
                        Constellation
                    </h1>
                    <p className="mt-4 font-mono text-xs md:text-sm max-w-lg opacity-70">
                        High-velocity dynamic mesh. Sweep your cursor quickly across the grid to unleash kinetic shockwaves.
                    </p>
                </div>
            )}

            {children && <div className="relative z-10 w-full">{children}</div>}
        </div>
    );
}
