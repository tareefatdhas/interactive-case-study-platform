'use client';

import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, db, storage } from './config';
import { COLLECTIONS } from './firestore';

const ALLOWED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const PROFILE_IMAGE_SIZE = 512;

const profileImageRef = (uid: string) => ref(storage, `teacher-profile-images/${uid}/profile.webp`);

export function validateProfileImage(file: File): void {
  if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose an image smaller than 8 MB.');
  }
}

export async function prepareProfileImage(file: File): Promise<File> {
  validateProfileImage(file);

  const objectURL = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectURL;
    await image.decode();

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceSize) throw new Error('That image could not be read. Choose another file.');

    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = PROFILE_IMAGE_SIZE;
    canvas.height = PROFILE_IMAGE_SIZE;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('That image could not be prepared. Choose another file.');

    context.fillStyle = '#fffefa';
    context.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      PROFILE_IMAGE_SIZE,
      PROFILE_IMAGE_SIZE,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('That image could not be prepared. Choose another file.')),
        'image/webp',
        0.88,
      );
    });

    return new File([blob], 'profile.webp', { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

export async function updateTeacherProfile(name: string, photoFile?: File | null): Promise<void> {
  const user = auth.currentUser;
  const cleanName = name.trim();
  if (!user) throw new Error('Sign in again to update your profile.');
  if (cleanName.length < 2) throw new Error('Enter the name you want students to see.');

  let photoURL = user.photoURL || undefined;
  if (photoFile) {
    const snapshot = await uploadBytes(profileImageRef(user.uid), photoFile, {
      contentType: photoFile.type,
      cacheControl: 'public,max-age=3600',
    });
    photoURL = await getDownloadURL(snapshot.ref);
  }

  await updateDoc(doc(db, COLLECTIONS.TEACHERS, user.uid), {
    name: cleanName,
    ...(photoURL ? { photoURL } : {}),
    updatedAt: serverTimestamp(),
  });
  await updateProfile(user, { displayName: cleanName, ...(photoURL ? { photoURL } : {}) });
}

export async function removeTeacherProfilePhoto(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to update your profile.');

  try {
    await deleteObject(profileImageRef(user.uid));
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code !== 'storage/object-not-found') throw error;
  }

  await updateDoc(doc(db, COLLECTIONS.TEACHERS, user.uid), {
    photoURL: deleteField(),
    updatedAt: serverTimestamp(),
  });
  await updateProfile(user, { photoURL: null });
}
