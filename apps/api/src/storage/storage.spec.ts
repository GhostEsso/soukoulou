import { imageType } from './storage.module';

describe('imageType', () => {
  it('reconnaît JPEG, PNG et WebP par leurs octets', () => {
    expect(imageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      imageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe('image/png');
    expect(imageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe(
      'image/webp',
    );
  });
  it('refuse le reste (PDF, SVG, texte)', () => {
    expect(imageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(
      imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(imageType(Buffer.alloc(0))).toBeNull();
  });
});
