<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT lmp FROM patient_profiles WHERE user_id=?");
$stmt->execute([$u['id']]);
$lmp = $stmt->fetchColumn();
$currentWeek = $lmp ? (int)floor((time() - strtotime($lmp)) / (7*86400)) : null;

$uploadDir = __DIR__ . '/uploads/bumps/' . $u['id'];
$uploadUrlBase = 'uploads/bumps/' . $u['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';
    if ($action === 'upload' && !empty($_FILES['photo']['name'])){
        $file = $_FILES['photo'];
        $allowed = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
        $mime = mime_content_type($file['tmp_name']);

        if ($file['error'] !== UPLOAD_ERR_OK){
            flash('Upload failed. Please try again.', 'error');
        } elseif (!isset($allowed[$mime])){
            flash('Only JPG, PNG, or WEBP images are allowed.', 'error');
        } elseif ($file['size'] > 8 * 1024 * 1024){
            flash('Image is too large (max 8MB).', 'error');
        } else {
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $ext = $allowed[$mime];
            $filename = uid('bump') . '.' . $ext;
            if (move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $filename)){
                $pdo->prepare("INSERT INTO bump_photos (id, user_id, week_number, date, filename, note) VALUES (?,?,?,?,?,?)")
                    ->execute([uid('bmp'), $u['id'], (int)$_POST['week_number'], today_iso(), $filename, trim($_POST['note'])]);
                flash('Bump photo added.', 'success');
                log_action('bump_photo_upload');
            } else {
                flash('Could not save the uploaded file.', 'error');
            }
        }
    } elseif ($action === 'delete'){
        $stmt = $pdo->prepare("SELECT * FROM bump_photos WHERE id=? AND user_id=?");
        $stmt->execute([$_POST['id'], $u['id']]);
        $photo = $stmt->fetch();
        if ($photo){
            @unlink($uploadDir . '/' . $photo['filename']);
            $pdo->prepare("DELETE FROM bump_photos WHERE id=?")->execute([$photo['id']]);
            flash('Photo deleted.', 'info');
        }
    }
    redirect('bump_photos.php');
}

$stmt = $pdo->prepare("SELECT * FROM bump_photos WHERE user_id=? ORDER BY week_number ASC");
$stmt->execute([$u['id']]);
$photos = $stmt->fetchAll();

render_header('Bump Photo Timeline', 'bump_photos');
?>

<div class="card" style="margin-bottom:16px;">
  <h3 style="margin-top:0;">Add a Bump Photo</h3>
  <form method="post" action="bump_photos.php" enctype="multipart/form-data">
    <input type="hidden" name="action" value="upload">
    <div class="grid grid-2">
      <div class="field"><label>Week Number</label><input type="number" name="week_number" min="1" max="42" value="<?php echo $currentWeek ?: 20; ?>" required></div>
      <div class="field"><label>Note (optional)</label><input type="text" name="note" placeholder="e.g. Starting to show!"></div>
    </div>
    <div class="field"><label>Photo</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></div>
    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-camera"></i> Upload Photo</button>
  </form>
</div>

<div class="card">
  <h3 style="margin-top:0;">Your Timeline</h3>
  <?php if (!$photos): ?>
    <div class="empty"><i class="fa-solid fa-images"></i>No bump photos yet. Upload your first one above.</div>
  <?php else: ?>
    <div class="photo-grid">
      <?php foreach ($photos as $p): ?>
        <div class="card" style="padding:10px;">
          <img src="<?php echo e($uploadUrlBase . '/' . $p['filename']); ?>" alt="Week <?php echo (int)$p['week_number']; ?> bump photo" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;">
          <div style="text-align:center;margin-top:8px;">
            <span class="badge badge-teal">Week <?php echo (int)$p['week_number']; ?></span>
            <?php if ($p['note']): ?><div class="muted" style="font-size:12px;margin-top:4px;"><?php echo e($p['note']); ?></div><?php endif; ?>
            <form method="post" action="bump_photos.php" onsubmit="return confirm('Delete this photo?');" style="margin-top:6px;">
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="<?php echo e($p['id']); ?>">
              <button class="btn btn-ghost btn-sm" type="submit"><i class="fa-solid fa-trash"></i></button>
            </form>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>

<?php render_footer(); ?>