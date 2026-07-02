import 'dart:io';
import 'package:image/image.dart' as img;

class ImageProcessService {
  /// Compress image based on target resolutionTag.
  /// Returns the path to the compressed file.
  static Future<String> compressImage(String originalPath, String resolutionTag) async {
    // 1. Determine targets
    int maxDimension = 1280;
    int maxSizeBytes = 500 * 1024; // 500KB
    
    if (resolutionTag == 'large') {
      maxDimension = 1920;
      maxSizeBytes = 1024 * 1024; // 1MB
    } else if (resolutionTag == 'small') {
      maxDimension = 800;
      maxSizeBytes = 200 * 1024; // 200KB
    }

    // 2. Load original image
    final originalFile = File(originalPath);
    final bytes = await originalFile.readAsBytes();
    img.Image? decoded = img.decodeImage(bytes);
    if (decoded == null) return originalPath;

    // 3. Resize if exceeds maxDimension
    int width = decoded.width;
    int height = decoded.height;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = (height * (maxDimension / width)).round();
        width = maxDimension;
      } else {
        width = (width * (maxDimension / height)).round();
        height = maxDimension;
      }
      decoded = img.copyResize(decoded, width: width, height: height);
    }

    // 4. Compress to JPEG with decreasing quality until size target is met
    int quality = 85;
    List<int> compressedBytes;
    // Ensure file extension is safe
    final targetPath = '${originalFile.parent.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';
                                   
    do {
      compressedBytes = img.encodeJpg(decoded, quality: quality);
      if (compressedBytes.length <= maxSizeBytes || quality <= 30) {
        break;
      }
      quality -= 10; // reduce quality step by step
    } while (compressedBytes.length > maxSizeBytes);

    // Write back to a new file
    final compressedFile = File(targetPath);
    await compressedFile.writeAsBytes(compressedBytes);
    return compressedFile.path;
  }
}
