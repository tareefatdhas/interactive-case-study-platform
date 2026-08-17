'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SIGNAL_PALETTES, safeSignalAvatar, type SignalAvatar } from '@/lib/gamification';
import SignalAvatarBadge from './SignalAvatarBadge';

function geometryFor(form: SignalAvatar['form']) {
  if (form === 'prism') return new THREE.DodecahedronGeometry(1.05, 1);
  if (form === 'bloom') return new THREE.TorusKnotGeometry(.74, .28, 96, 14, 2, 3);
  if (form === 'pebble') {
    const geometry = new THREE.SphereGeometry(1, 48, 32);
    geometry.scale(1.12, .92, 1);
    return geometry;
  }
  return new THREE.SphereGeometry(1, 48, 32);
}

export default function SignalAvatar3D({ avatar, className = '' }: { avatar?: Partial<SignalAvatar>; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const safe = safeSignalAvatar(avatar);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !window.WebGLRenderingContext) return;
    const fallback = host.querySelector<HTMLElement>('[data-signal-fallback]');
    if (fallback) fallback.style.display = 'none';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = SIGNAL_PALETTES[safe.palette];
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    camera.position.set(0, .12, 5.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const bodyGeometry = geometryFor(safe.form);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: colors.primary,
      roughness: .2,
      metalness: .05,
      clearcoat: 1,
      clearcoatRoughness: .18,
      emissive: new THREE.Color(colors.glow),
      emissiveIntensity: .1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.z = safe.form === 'prism' ? .12 : 0;
    group.add(body);

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: colors.ink, roughness: .45 });
    const eyeGeometry = new THREE.SphereGeometry(.09, 18, 14);
    const eyeY = safe.face === 'focused' ? .15 : .22;
    [-.3, .3].forEach((x) => {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(x, eyeY, .94);
      if (safe.face === 'focused') eye.scale.set(1.2, .65, 1);
      group.add(eye);
    });

    const mouth = safe.face === 'bright'
      ? new THREE.Mesh(new THREE.TorusGeometry(.24, .025, 8, 30, Math.PI), eyeMaterial)
      : safe.face === 'curious'
        ? new THREE.Mesh(new THREE.TorusGeometry(.09, .022, 8, 24), eyeMaterial)
        : new THREE.Mesh(new THREE.BoxGeometry(.26, .035, .025), eyeMaterial);
    mouth.position.set(0, -.2, .98);
    if (safe.face === 'bright') mouth.rotation.z = Math.PI;
    group.add(mouth);

    if (safe.orbit !== 'none') {
      const orbitGeometry = new THREE.TorusGeometry(1.5, .025, 10, 96);
      const orbitMaterial = new THREE.MeshBasicMaterial({ color: colors.secondary, transparent: true, opacity: .72 });
      const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbit.rotation.set(1.12, .08, -.32);
      group.add(orbit);
      if (safe.orbit === 'satellites') {
        [[1.22, -.55, .68], [-1.24, .46, -.28]].forEach(([x, y, z], index) => {
          const satellite = new THREE.Mesh(new THREE.SphereGeometry(index ? .07 : .1, 16, 12), new THREE.MeshStandardMaterial({ color: colors.secondary, emissive: colors.primary, emissiveIntensity: .22 }));
          satellite.position.set(x, y, z);
          group.add(satellite);
        });
      }
      if (safe.orbit === 'trail') {
        Array.from({ length: 7 }, (_, index) => {
          const angle = .55 + index * .22;
          const particle = new THREE.Mesh(new THREE.SphereGeometry(.075 - index * .006, 12, 10), new THREE.MeshBasicMaterial({ color: colors.secondary, transparent: true, opacity: .88 - index * .08 }));
          particle.position.set(Math.cos(angle) * 1.42, Math.sin(angle) * .58, .35 - index * .08);
          group.add(particle);
          return particle;
        });
      }
    }

    scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(colors.primary), 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const rim = new THREE.PointLight(new THREE.Color(colors.secondary), 14, 8);
    rim.position.set(2.5, -.5, 2.5);
    scene.add(rim);

    let visible = true;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      // Keep the high-density drawing buffer for a crisp Signal, but size the
      // canvas itself in CSS pixels. Without this, Retina screens can make the
      // canvas twice as wide as its stage and visually push the Signal off-center.
      renderer.setSize(width, height, true);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - .5) * .42;
      pointerY = ((event.clientY - rect.top) / rect.height - .5) * .24;
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .05 });
    observer.observe(host);
    host.addEventListener('pointermove', onPointerMove);
    const render = (time: number) => {
      if (visible && !document.hidden) {
        const t = time / 1000;
        group.rotation.y += ((reduceMotion ? 0 : Math.sin(t * .52) * .2) + pointerX - group.rotation.y) * .045;
        group.rotation.x += (-pointerY - group.rotation.x) * .045;
        group.position.y = reduceMotion ? 0 : Math.sin(t * 1.15) * .08;
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(render);
    };
    resize();
    frame = requestAnimationFrame(render);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      eyeGeometry.dispose();
      eyeMaterial.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object !== body) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (fallback) fallback.style.display = '';
    };
  }, [safe.face, safe.form, safe.orbit, safe.palette]);

  return <div ref={hostRef} className={className} role="img" aria-label={`${safe.palette} ${safe.form} Signal avatar`}><span data-signal-fallback style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><SignalAvatarBadge avatar={safe} size={126} decorative /></span></div>;
}
