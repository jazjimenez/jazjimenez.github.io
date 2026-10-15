import * as THREE from 'three'

/** Center of the window opening in the left wall (x is the wall's inner face). */
export const WINDOW_CENTER: [number, number, number] = [-3, 1.85, -0.6]

/** Where your eyes are while sitting in the chair at the desk. */
export const SEAT_EYE = new THREE.Vector3(0, 1.2, -1.7)

/** Leaning in until the laptop screen fills the view. */
export const LAPTOP_EYE = new THREE.Vector3(0, 1.226, -1.891)
export const LAPTOP_LOOK = new THREE.Vector3(0, 1.033, -2.647)

/** Direction the sun comes from (it shines toward the origin). Only reaches in through the window. */
export const SUN_POSITION = new THREE.Vector3(-9, 6.5, 1.2)
