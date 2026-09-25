# 🏆 Bài 8: Dự án cuối khóa - Game 2D "Coin Collector"

## 🎯 Mục tiêu bài học

- Tự tay làm một game 2D **hoàn chỉnh từ đầu đến cuối**: menu → chơi → thắng/thua → chơi lại
- Kết hợp kiến thức của cả 7 bài trước vào một project thực tế
- Biết cách tổ chức project, scene, prefab và script cho một game nhỏ
- Dùng Physics 2D, Input, Coroutine, Event, Singleton, ScriptableObject, UI, Audio
- Build game ra WebGL và chia sẻ lên itch.io

> 💡 **Cách học bài này**: Làm **tuần tự từng bước**, và bấm **Play để test sau mỗi bước**. Đừng copy tất cả script một lúc rồi mới chạy - khi có lỗi bạn sẽ không biết lỗi nằm ở đâu.
>
> Bài viết cho **Unity 6 LTS**. Nếu dùng Unity 2022 LTS, đổi `rb.linearVelocity` thành `rb.velocity` (xem Bài 3).

## 🗺️ 1. Tổng quan dự án

### Gameplay

Người chơi điều khiển một nhân vật chạy nhảy trên các bục (platform):

- 🪙 **Nhặt hết xu** trong màn chơi để được về đích
- 👾 **Tránh quái** đi tuần tra và **không rơi xuống vực** - mỗi lần trúng sẽ mất 1 mạng và hồi sinh ở điểm xuất phát
- ⏱️ **Hết giờ** hoặc **hết mạng** → thua
- 🏁 **Chạm lá cờ** sau khi nhặt hết xu → thắng, được cộng điểm thưởng theo thời gian còn lại
- 🏅 Điểm cao nhất (**kỷ lục**) được lưu lại giữa các lần chơi

### Kiến thức sử dụng lại

| Bài | Kiến thức | Dùng ở đâu trong dự án |
| --- | --- | --- |
| Bài 1 | Class, Properties, `enum`, `switch`, Events (`Action`) | `GameManager`, `GameState`, HUD lắng nghe event |
| Bài 2 | GameObject, Prefab, Tag, Layer, Singleton, ScriptableObject | Coin/Enemy prefab, `GameManager.Instance`, `GameSettings` |
| Bài 3 | Rigidbody2D, Collider2D, Trigger, `Physics2D.OverlapCircle` | Nhân vật, xu, quái, vực, lá cờ |
| Bài 4 | `Update` vs `FixedUpdate`, Input, `Time.deltaTime`, Coroutine | Di chuyển, nhảy, đồng hồ đếm ngược, nhấp nháy khi bất tử |
| Bài 5 | Canvas, TextMeshPro, Button, Panel, `SceneManager`, `PlayerPrefs` | HUD, menu tạm dừng, màn hình kết quả, Main Menu |
| Bài 6 | AudioSource, `PlayOneShot`, Animator | Âm thanh nhặt xu/nhảy/thắng/thua, animation nhân vật |
| Bài 7 | Tổ chức project, Observer pattern, Git, Build | Cấu trúc thư mục, event, build WebGL |

### Danh sách script

| Script | Nhiệm vụ |
| --- | --- |
| `GameSettings.cs` | ScriptableObject chứa thông số (số mạng, điểm mỗi xu, thời gian) |
| `GameManager.cs` | Quản lý điểm, mạng, thời gian, trạng thái game; phát event |
| `PlayerController2D.cs` | Di chuyển, nhảy, nhận sát thương, hồi sinh |
| `CameraFollow2D.cs` | Camera đi theo nhân vật |
| `Coin.cs` | Xu nhấp nhô, bị nhặt khi chạm nhân vật |
| `EnemyPatrol.cs` | Quái đi qua đi lại |
| `Goal.cs` | Lá cờ đích |
| `AudioManager.cs` | Phát nhạc nền và hiệu ứng âm thanh |
| `HUD.cs` | Hiển thị điểm/mạng/xu/thời gian, menu tạm dừng, màn hình kết quả |
| `MainMenu.cs` | Màn hình menu chính |

## 🛠️ 2. Chuẩn bị project

### Bước 1: Tạo project

1. Mở **Unity Hub → New Project** → chọn template **Universal 2D** (hoặc **2D**)
2. Đặt tên `CoinCollector` → **Create project**
3. Vào **Edit → Project Settings → Player → Other Settings → Active Input Handling** → chọn **Both** → Unity sẽ yêu cầu khởi động lại Editor (xem Bài 4 - Input System)

### Bước 2: Tạo cấu trúc thư mục

Trong cửa sổ **Project**, tạo các thư mục sau trong `Assets/` (chuột phải → **Create → Folder**):

```
Assets/
├── _Project/
│   ├── Scripts/
│   ├── Prefabs/
│   ├── Scenes/
│   ├── Settings/
│   ├── Audio/
│   ├── Animations/
│   └── Physics/
```

> 💡 Dấu `_` giúp thư mục `_Project` luôn nằm trên cùng, tách biệt với asset tải từ Asset Store (Bài 7 - Best Practices).

### Bước 3: Tạo Tag và Layer

Vào **Edit → Project Settings → Tags and Layers**:

- **Tags**: thêm `Enemy` và `Hazard` (tag `Player` đã có sẵn)
- **Layers**: thêm layer `Ground` vào một ô User Layer trống

### Bước 4: Tạo 2 scene

1. **File → New Scene** (chọn Basic 2D) → **File → Save As** → `Assets/_Project/Scenes/MainMenu.unity`
2. Làm lại để tạo `Assets/_Project/Scenes/Game.unity`
3. Mở **File → Build Profiles** (Unity 2022: **File → Build Settings**) → kéo **MainMenu** vào danh sách scene trước, rồi đến **Game**. MainMenu phải có index **0** để game mở vào menu

> ⚠️ Nếu quên thêm scene vào danh sách build, `SceneManager.LoadScene` sẽ báo lỗi (Bài 5, phần 7).

### Bước 5: Khởi tạo Git (khuyến khích)

Làm theo phần **Git và Version Control** ở Bài 7: tạo `.gitignore` cho Unity rồi commit lần đầu. Sau mỗi bước làm xong trong bài này, hãy commit một lần - nếu làm hỏng thì quay lại được.

## 🧱 3. Dựng level

Mở scene **Game**. Ta dùng hình khối có sẵn nên không cần tải hình ảnh.

### Bước 1: Mặt đất và các bục

1. **GameObject → 2D Object → Sprites → Square**, đổi tên thành `Ground`
2. Chỉnh **Transform**: Position `(0, -3, 0)`, Scale `(20, 1, 1)`. Đổi **Color** trong Sprite Renderer thành màu xanh lá
3. **Add Component → Box Collider 2D**
4. Ở góc trên Inspector, đổi **Layer** thành `Ground`
5. Tạo một bục nhỏ: duplicate `Ground` (**Ctrl+D**), đổi tên `Platform`, Scale `(4, 0.5, 1)`, đặt lên cao hơn
6. Kéo `Platform` vào thư mục `Prefabs` để tạo **Prefab** (Bài 2, phần 5). Sau đó kéo prefab vào scene nhiều lần để tạo các bục ở độ cao khác nhau

> ⚠️ Mọi thứ nhân vật có thể đứng lên đều phải thuộc layer **Ground**, nếu không nhân vật sẽ không nhảy được.

### Bước 2: Vực chết (Kill Zone)

1. **GameObject → Create Empty**, đặt tên `KillZone`, Position `(0, -8, 0)`
2. **Add Component → Box Collider 2D**, bật **Is Trigger**, Size `(100, 1)`
3. Đổi **Tag** thành `Hazard`

Khi nhân vật rơi khỏi bục và chạm vùng này, sẽ bị mất mạng.

### Bước 3: Điểm hồi sinh

**GameObject → Create Empty**, đặt tên `SpawnPoint`, đặt ở vị trí bắt đầu (vd: `(-8, -1, 0)`).

## 🏃 4. Nhân vật (Player)

### Bước 1: Tạo GameObject

1. **GameObject → 2D Object → Sprites → Capsule**, đổi tên `Player`, đặt Position trùng `SpawnPoint`
2. **Tag** = `Player`, **Layer** giữ `Default` (**không** đặt Ground, nếu không nhân vật sẽ tự "thấy" mình là mặt đất)
3. **Add Component → Rigidbody 2D**:
   - **Gravity Scale** = `3` (rơi nhanh hơn, cảm giác nhảy "chắc tay" hơn)
   - **Collision Detection** = `Continuous`
   - **Interpolate** = `Interpolate` (chuyển động mượt)
   - **Constraints → Freeze Rotation Z** = ✅ (không bị lật đổ)
4. **Add Component → Capsule Collider 2D**
5. Tạo **Physics Material 2D** chống dính tường: trong thư mục `Physics`, chuột phải → **Create → 2D → Physics Material 2D**, đặt tên `NoFriction`, **Friction** = `0`. Kéo vào ô **Material** của Capsule Collider 2D
6. Tạo điểm kiểm tra chân: chuột phải `Player` → **Create Empty**, đặt tên `GroundCheck`, Position `(0, -1, 0)` (ngay dưới chân)

### Bước 2: Script PlayerController2D

Tạo script `Assets/_Project/Scripts/PlayerController2D.cs`:

```csharp
using System.Collections;
using UnityEngine;

// Điều khiển nhân vật 2D: di chuyển, nhảy, nhận sát thương, hồi sinh
[RequireComponent(typeof(Rigidbody2D))]
public class PlayerController2D : MonoBehaviour
{
    [Header("Di chuyển")]
    [SerializeField] private float moveSpeed = 7f;
    [SerializeField] private float jumpForce = 12f;

    [Header("Kiểm tra mặt đất")]
    [SerializeField] private Transform groundCheck;
    [SerializeField] private float groundCheckRadius = 0.15f;
    [SerializeField] private LayerMask groundLayer;

    [Header("Hồi sinh")]
    [SerializeField] private Transform spawnPoint;
    [SerializeField] private float invincibleTime = 1.5f; // Thời gian bất tử sau khi hồi sinh

    [Header("Âm thanh")]
    [SerializeField] private AudioClip jumpSound;
    [SerializeField] private AudioClip hurtSound;

    private Rigidbody2D rb;
    private SpriteRenderer spriteRenderer;
    private Animator animator; // Tùy chọn - có thể không có (phần 13)

    private float moveInput;
    private bool jumpRequested;
    private bool isGrounded;
    private bool isInvincible;

    // Cache hash của parameter Animator để nhanh hơn dùng string (Bài 6)
    private static readonly int SpeedHash = Animator.StringToHash("Speed");
    private static readonly int GroundedHash = Animator.StringToHash("IsGrounded");

    void Awake()
    {
        // Lấy component một lần và cache lại (Bài 4, phần 6)
        rb = GetComponent<Rigidbody2D>();
        spriteRenderer = GetComponent<SpriteRenderer>();
        animator = GetComponent<Animator>();
    }

    void Update()
    {
        // Khi game đang dừng (pause/thắng/thua) thì không nhận input
        if (Time.timeScale == 0f) return;

        // 1. Đọc input trong Update - không bỏ lỡ phím nhấn (Bài 4, phần 2)
        moveInput = Input.GetAxisRaw("Horizontal"); // -1, 0 hoặc 1

        if (Input.GetButtonDown("Jump") && isGrounded) // "Jump" = phím Space
        {
            jumpRequested = true; // Chỉ ghi nhớ, xử lý vật lý trong FixedUpdate
        }

        // 2. Lật sprite theo hướng di chuyển
        if (moveInput != 0f)
        {
            spriteRenderer.flipX = moveInput < 0f;
        }

        // 3. Cập nhật Animator nếu có
        if (animator != null)
        {
            animator.SetFloat(SpeedHash, Mathf.Abs(moveInput));
            animator.SetBool(GroundedHash, isGrounded);
        }
    }

    void FixedUpdate()
    {
        // Kiểm tra chạm đất bằng một vòng tròn nhỏ ở chân (Bài 3, phần 8)
        isGrounded = Physics2D.OverlapCircle(groundCheck.position, groundCheckRadius, groundLayer);

        // Di chuyển ngang, giữ nguyên vận tốc Y để trọng lực vẫn hoạt động
        // Unity 6: linearVelocity - Unity 2022 trở về trước: velocity
        rb.linearVelocity = new Vector2(moveInput * moveSpeed, rb.linearVelocity.y);

        if (jumpRequested)
        {
            jumpRequested = false;
            // Reset vận tốc Y để lần nhảy nào cũng cao như nhau
            rb.linearVelocity = new Vector2(rb.linearVelocity.x, 0f);
            rb.AddForce(Vector2.up * jumpForce, ForceMode2D.Impulse);
            AudioManager.Play(jumpSound);
        }
    }

    // Gọi mỗi bước physics khi đang chạm trigger.
    // Dùng Stay thay vì Enter: nếu hết thời gian bất tử mà vẫn đứng trong quái thì vẫn bị tính trúng
    void OnTriggerStay2D(Collider2D other)
    {
        if (isInvincible) return;

        if (other.CompareTag("Enemy") || other.CompareTag("Hazard"))
        {
            GameManager.Instance.PlayerHit();
        }
    }

    // GameManager gọi hàm này khi người chơi còn mạng
    public void Respawn()
    {
        AudioManager.Play(hurtSound);

        rb.linearVelocity = Vector2.zero;
        transform.position = spawnPoint.position;

        StartCoroutine(InvincibleRoutine());
    }

    // Coroutine nhấp nháy trong thời gian bất tử (Bài 4, phần 7)
    IEnumerator InvincibleRoutine()
    {
        isInvincible = true;

        float elapsed = 0f;
        while (elapsed < invincibleTime)
        {
            spriteRenderer.enabled = !spriteRenderer.enabled; // Ẩn/hiện liên tục
            yield return new WaitForSeconds(0.1f);
            elapsed += 0.1f;
        }

        spriteRenderer.enabled = true;
        isInvincible = false;
    }

    // Vẽ vòng kiểm tra mặt đất trong Scene view để dễ căn chỉnh
    void OnDrawGizmosSelected()
    {
        if (groundCheck == null) return;
        Gizmos.color = Color.green;
        Gizmos.DrawWireSphere(groundCheck.position, groundCheckRadius);
    }
}
```

> 📝 Script này gọi `GameManager` và `AudioManager` - hai script ta sẽ viết ở phần 6 và 10. Unity sẽ báo lỗi compile cho tới khi bạn tạo xong chúng. Nếu muốn test nhân vật ngay, tạm thời comment (`//`) các dòng `AudioManager.Play(...)` và `GameManager.Instance.PlayerHit();`.

### Bước 3: Gắn script và test

1. Kéo `PlayerController2D` vào `Player`
2. Trong Inspector: kéo `GroundCheck` vào ô **Ground Check**, `SpawnPoint` vào ô **Spawn Point**, chọn **Ground Layer** = `Ground`
3. Bấm **Play**: dùng **A/D** hoặc **←/→** để chạy, **Space** để nhảy

> 💡 **Tại sao đọc input ở Update nhưng di chuyển ở FixedUpdate?** `Input.GetButtonDown` chỉ đúng trong **một frame**; `FixedUpdate` có thể không chạy ở frame đó nên dễ bị "nuốt" phím. Còn Rigidbody nên được điều khiển trong `FixedUpdate` để vật lý ổn định (Bài 4, phần 1).

## 📷 5. Camera theo dõi nhân vật

Tạo script `CameraFollow2D.cs` và gắn vào **Main Camera**:

```csharp
using UnityEngine;

// Camera đi theo nhân vật một cách mượt mà
public class CameraFollow2D : MonoBehaviour
{
    [SerializeField] private Transform target;
    // z = -10 để camera luôn đứng trước cảnh 2D (các sprite ở z = 0)
    [SerializeField] private Vector3 offset = new Vector3(0f, 1f, -10f);
    [SerializeField] private float smoothTime = 0.2f;
    [SerializeField] private float minY = -2f; // Không cho camera đi quá thấp khi nhân vật rơi xuống vực

    private Vector3 velocity; // SmoothDamp dùng biến này để lưu vận tốc hiện tại

    // LateUpdate chạy sau khi nhân vật đã di chuyển xong trong frame (Bài 4, phần 1)
    void LateUpdate()
    {
        if (target == null) return;

        Vector3 desired = target.position + offset;
        desired.y = Mathf.Max(desired.y, minY);

        transform.position = Vector3.SmoothDamp(transform.position, desired, ref velocity, smoothTime);
    }
}
```

Kéo `Player` vào ô **Target**. Bấm Play để kiểm tra.

> 💡 Dự án lớn hơn có thể dùng package **Cinemachine** (Package Manager) để có camera chuyên nghiệp mà không cần code.

## ⚙️ 6. GameSettings và GameManager

### Bước 1: ScriptableObject GameSettings

Tạo script `GameSettings.cs` (Bài 2, phần 9):

```csharp
using UnityEngine;

// Chứa thông số game dưới dạng asset - chỉnh trong Inspector, không cần sửa code
[CreateAssetMenu(fileName = "GameSettings", menuName = "CoinCollector/Game Settings")]
public class GameSettings : ScriptableObject
{
    [Header("Người chơi")]
    [Min(1)] public int startLives = 3;

    [Header("Điểm")]
    public int coinValue = 10;          // Điểm cho mỗi đồng xu
    public int timeBonusPerSecond = 5;  // Điểm thưởng cho mỗi giây còn lại khi thắng

    [Header("Thời gian")]
    public float timeLimit = 120f;      // Thời gian chơi (giây)
}
```

Trong thư mục `Settings`, chuột phải → **Create → CoinCollector → Game Settings** để tạo asset `GameSettings`.

### Bước 2: Script GameManager

Tạo script `GameManager.cs`:

```csharp
using System;
using UnityEngine;
using UnityEngine.SceneManagement;

// Các trạng thái của game (enum - Bài 1)
public enum GameState
{
    Playing,
    Paused,
    Won,
    Lost
}

// Quản lý toàn bộ luật chơi: điểm, mạng, thời gian, thắng/thua
public class GameManager : MonoBehaviour
{
    // Singleton (Bài 2, phần 7)
    public static GameManager Instance { get; private set; }

    [SerializeField] private GameSettings settings;
    [SerializeField] private PlayerController2D player;
    [SerializeField] private string menuSceneName = "MainMenu";

    // Properties: ai cũng đọc được, nhưng chỉ GameManager được sửa (Bài 1, phần 9)
    public GameState State { get; private set; }
    public int Score { get; private set; }
    public int Lives { get; private set; }
    public float TimeRemaining { get; private set; }
    public int CoinsCollected { get; private set; }
    public int TotalCoins { get; private set; }

    // Events: HUD và AudioManager đăng ký lắng nghe (Bài 1, phần 14 - Observer pattern, Bài 7)
    public event Action<int> OnScoreChanged;
    public event Action<int> OnLivesChanged;
    public event Action<int, int> OnCoinsChanged; // (số xu đã nhặt, tổng số xu)
    public event Action<GameState> OnStateChanged;
    public event Action<string> OnMessage;

    private const string HighScoreKey = "HighScore";

    void Awake()
    {
        // Singleton đơn giản. KHÔNG dùng DontDestroyOnLoad vì mỗi lần chơi lại
        // ta load lại scene và muốn mọi thứ trở về trạng thái ban đầu
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;

        // Time.timeScale KHÔNG tự reset khi load scene → phải đặt lại
        Time.timeScale = 1f;

        // Khởi tạo trong Awake để các script khác đọc được ngay trong Start
        State = GameState.Playing;
        Score = 0;
        Lives = settings.startLives;
        TimeRemaining = settings.timeLimit;
        CoinsCollected = 0;
        TotalCoins = FindObjectsByType<Coin>(FindObjectsSortMode.None).Length; // Đếm số xu trong scene
    }

    void OnDestroy()
    {
        if (Instance == this)
        {
            Instance = null;
        }
    }

    void Update()
    {
        // Pause / Resume bằng phím Escape
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            TogglePause();
        }

        if (State != GameState.Playing) return;

        // Đếm ngược thời gian (Bài 4, phần 4)
        TimeRemaining -= Time.deltaTime;
        if (TimeRemaining <= 0f)
        {
            TimeRemaining = 0f;
            EndGame(false);
        }
    }

    // Coin gọi khi được nhặt
    public void CollectCoin()
    {
        if (State != GameState.Playing) return;

        CoinsCollected++;
        Score += settings.coinValue;

        OnScoreChanged?.Invoke(Score);
        OnCoinsChanged?.Invoke(CoinsCollected, TotalCoins);

        if (CoinsCollected == TotalCoins)
        {
            OnMessage?.Invoke("Đã nhặt hết xu! Hãy tới lá cờ!");
        }
    }

    // Goal gọi khi nhân vật chạm lá cờ
    public void ReachGoal()
    {
        if (State != GameState.Playing) return;

        if (CoinsCollected < TotalCoins)
        {
            OnMessage?.Invoke($"Còn {TotalCoins - CoinsCollected} xu chưa nhặt!");
            return;
        }

        // Thưởng điểm theo số giây còn lại
        Score += Mathf.FloorToInt(TimeRemaining) * settings.timeBonusPerSecond;
        OnScoreChanged?.Invoke(Score);

        EndGame(true);
    }

    // PlayerController2D gọi khi chạm quái hoặc rơi xuống vực
    public void PlayerHit()
    {
        if (State != GameState.Playing) return;

        Lives--;
        OnLivesChanged?.Invoke(Lives);

        if (Lives <= 0)
        {
            EndGame(false);
        }
        else
        {
            player.Respawn();
        }
    }

    public void TogglePause()
    {
        if (State == GameState.Playing)
        {
            Time.timeScale = 0f; // Dừng mọi thứ dùng Time.deltaTime và physics
            SetState(GameState.Paused);
        }
        else if (State == GameState.Paused)
        {
            Time.timeScale = 1f;
            SetState(GameState.Playing);
        }
    }

    public void RestartLevel()
    {
        // Load lại scene hiện tại - Awake sẽ đặt lại Time.timeScale = 1
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    public void LoadMenu()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(menuSceneName);
    }

    void EndGame(bool won)
    {
        Time.timeScale = 0f;

        // Lưu kỷ lục TRƯỚC khi báo event, để HUD đọc được kỷ lục mới (PlayerPrefs - Bài 5)
        if (Score > PlayerPrefs.GetInt(HighScoreKey, 0))
        {
            PlayerPrefs.SetInt(HighScoreKey, Score);
            PlayerPrefs.Save();
        }

        SetState(won ? GameState.Won : GameState.Lost);
    }

    void SetState(GameState newState)
    {
        State = newState;
        OnStateChanged?.Invoke(newState);
    }
}
```

> 💡 **`?.Invoke` với event là an toàn** vì event là delegate C# thuần. Còn với object của Unity (GameObject, Component...) thì dùng `!= null` (Bài 4, phần 9).

### Bước 3: Gắn vào scene

1. **GameObject → Create Empty**, đặt tên `GameManager`, **Add Component → GameManager**
2. Kéo asset `GameSettings` vào ô **Settings**, kéo `Player` vào ô **Player**

## 🪙 7. Đồng xu (Coin)

### Bước 1: Script Coin

```csharp
using UnityEngine;

// Đồng xu nhấp nhô, bị nhặt khi nhân vật chạm vào
public class Coin : MonoBehaviour
{
    [SerializeField] private AudioClip collectSound;
    [SerializeField] private float bobHeight = 0.15f; // Biên độ nhấp nhô
    [SerializeField] private float bobSpeed = 3f;

    private Vector3 startPos;
    private float bobOffset;
    private bool collected;

    void Start()
    {
        startPos = transform.position;
        // Lệch pha ngẫu nhiên để các xu không nhấp nhô giống hệt nhau
        bobOffset = Random.Range(0f, 2f * Mathf.PI);
    }

    void Update()
    {
        // Nhấp nhô lên xuống bằng hàm Sin theo thời gian
        float y = Mathf.Sin(Time.time * bobSpeed + bobOffset) * bobHeight;
        transform.position = startPos + new Vector3(0f, y, 0f);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (collected || !other.CompareTag("Player")) return;

        collected = true; // Tránh bị tính 2 lần nếu có 2 collider chạm cùng lúc
        GameManager.Instance.CollectCoin();
        AudioManager.Play(collectSound);
        Destroy(gameObject);
    }
}
```

### Bước 2: Tạo Prefab Coin

1. **GameObject → 2D Object → Sprites → Circle**, đổi tên `Coin`, Scale `(0.5, 0.5, 1)`, màu vàng
2. **Add Component → Circle Collider 2D**, bật **Is Trigger**
3. **Add Component → Coin**
4. Kéo vào thư mục `Prefabs` để tạo prefab, rồi xóa bản trong scene
5. Kéo prefab `Coin` vào scene **8-10 lần**, đặt rải rác trên các bục

> 💡 `GameManager` tự đếm số xu trong scene lúc bắt đầu, nên bạn thêm/bớt xu thoải mái mà không cần sửa code.

## 👾 8. Quái tuần tra (Enemy)

### Bước 1: Script EnemyPatrol

```csharp
using UnityEngine;

// Quái đi qua đi lại quanh vị trí ban đầu
[RequireComponent(typeof(Rigidbody2D))]
public class EnemyPatrol : MonoBehaviour
{
    [SerializeField] private float speed = 2f;
    [SerializeField] private float patrolDistance = 3f; // Đi xa bao nhiêu mỗi bên

    private Rigidbody2D rb;
    private SpriteRenderer spriteRenderer;
    private float leftX;
    private float rightX;
    private int direction = 1; // 1 = sang phải, -1 = sang trái

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        spriteRenderer = GetComponent<SpriteRenderer>();
    }

    void Start()
    {
        leftX = transform.position.x - patrolDistance;
        rightX = transform.position.x + patrolDistance;
    }

    void FixedUpdate()
    {
        Vector2 next = rb.position + Vector2.right * direction * speed * Time.fixedDeltaTime;

        // Tới biên thì quay đầu
        if (next.x >= rightX)
        {
            direction = -1;
        }
        else if (next.x <= leftX)
        {
            direction = 1;
        }

        // Rigidbody2D Kinematic nên di chuyển bằng MovePosition
        rb.MovePosition(next);
        spriteRenderer.flipX = direction < 0;
    }

    // Vẽ đường tuần tra trong Scene view khi chọn quái
    void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.red;
        Vector3 p = transform.position;
        Gizmos.DrawLine(p + Vector3.left * patrolDistance, p + Vector3.right * patrolDistance);
    }
}
```

### Bước 2: Tạo Prefab Enemy

1. **GameObject → 2D Object → Sprites → Square**, đổi tên `Enemy`, Scale `(0.8, 0.8, 1)`, màu đỏ
2. **Tag** = `Enemy`
3. **Add Component → Box Collider 2D**, bật **Is Trigger**
4. **Add Component → Rigidbody 2D**, **Body Type** = `Kinematic` (không bị trọng lực, chỉ di chuyển bằng code)
5. **Add Component → EnemyPatrol**
6. Tạo prefab, rồi đặt 2-3 quái lên các bục đủ rộng. Chọn từng quái để xem đường tuần tra màu đỏ, chỉnh **Patrol Distance** sao cho không đi ra ngoài bục

## 🏁 9. Lá cờ đích (Goal)

```csharp
using UnityEngine;

// Lá cờ đích - thắng nếu đã nhặt hết xu
public class Goal : MonoBehaviour
{
    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Player"))
        {
            GameManager.Instance.ReachGoal();
        }
    }
}
```

1. **GameObject → 2D Object → Sprites → Triangle** (hoặc Square), đổi tên `Goal`, màu trắng, đặt ở cuối màn
2. **Add Component → Box Collider 2D** (hoặc Polygon Collider 2D), bật **Is Trigger**
3. **Add Component → Goal**

## 🔊 10. Âm thanh (AudioManager)

### Bước 1: Script AudioManager

```csharp
using UnityEngine;

// Phát nhạc nền và hiệu ứng âm thanh (Bài 6)
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    [SerializeField] private AudioSource musicSource; // Nhạc nền (Loop)
    [SerializeField] private AudioSource sfxSource;   // Hiệu ứng (PlayOneShot)

    [Header("Âm thanh kết thúc")]
    [SerializeField] private AudioClip winSound;
    [SerializeField] private AudioClip loseSound;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    void Start()
    {
        // Lắng nghe GameManager (Observer pattern) - Start chạy sau mọi Awake nên Instance đã sẵn sàng
        GameManager.Instance.OnStateChanged += HandleStateChanged;
    }

    void OnDestroy()
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.OnStateChanged -= HandleStateChanged;
        }

        if (Instance == this)
        {
            Instance = null;
        }
    }

    void HandleStateChanged(GameState state)
    {
        switch (state)
        {
            case GameState.Paused:
                musicSource.Pause();
                break;
            case GameState.Playing:
                musicSource.UnPause();
                break;
            case GameState.Won:
                musicSource.Stop();
                Play(winSound);
                break;
            case GameState.Lost:
                musicSource.Stop();
                Play(loseSound);
                break;
        }
    }

    // Hàm static tiện lợi: gọi AudioManager.Play(clip) từ bất kỳ đâu.
    // An toàn khi scene chưa có AudioManager hoặc clip chưa được gán
    public static void Play(AudioClip clip)
    {
        if (Instance != null && clip != null)
        {
            Instance.sfxSource.PlayOneShot(clip);
        }
    }
}
```

### Bước 2: Setup trong scene

1. Tải vài file âm thanh miễn phí (vd: [freesound.org](https://freesound.org), [kenney.nl/assets](https://kenney.nl/assets)) vào thư mục `Audio`: nhạc nền, tiếng nhặt xu, nhảy, bị thương, thắng, thua
2. **GameObject → Create Empty**, đặt tên `AudioManager`, **Add Component → AudioManager**
3. Thêm **2 component Audio Source** vào `AudioManager`:
   - Source 1 (nhạc nền): kéo clip nhạc vào **Audio Resource/AudioClip**, bật **Loop** và **Play On Awake**, Volume `0.4`
   - Source 2 (hiệu ứng): để trống clip, tắt **Play On Awake**
4. Kéo Source 1 vào ô **Music Source**, Source 2 vào ô **Sfx Source**, gán **Win Sound** và **Lose Sound**
5. Gán **Jump Sound**, **Hurt Sound** cho `Player`, và **Collect Sound** cho prefab `Coin` (mở prefab rồi gán để mọi xu đều có âm thanh)

> 💡 Âm thanh vẫn phát khi `Time.timeScale = 0`, nên nhạc thắng/thua vẫn nghe được khi game đã dừng.

## 🖥️ 11. Giao diện trong game (HUD)

### Bước 1: Dựng Canvas

1. **GameObject → UI → Canvas** (Unity tự tạo thêm **EventSystem**)
2. Chọn Canvas → **Canvas Scaler**: **UI Scale Mode** = `Scale With Screen Size`, **Reference Resolution** = `1920 x 1080`, **Match** = `0.5` (Bài 5, phần 1)
3. Tạo các **Text - TextMeshPro** (chuột phải Canvas → **UI → Text - TextMeshPro**). Lần đầu bấm **Import TMP Essentials**:

| Tên | Anchor (Bài 5, phần 5) | Nội dung mẫu |
| --- | --- | --- |
| `ScoreText` | Góc trên trái | Điểm: 0 |
| `LivesText` | Góc trên trái (dưới ScoreText) | Mạng: 3 |
| `CoinsText` | Giữa phía trên | Xu: 0/10 |
| `TimeText` | Góc trên phải | 02:00 |
| `MessageText` | Giữa màn hình | (để trống) |

4. Tạo **PausePanel**: chuột phải Canvas → **UI → Panel**. Bên trong thêm Text "TẠM DỪNG" và 2 **Button - TextMeshPro**: `Tiếp tục`, `Về menu`
5. Tạo **ResultPanel**: một Panel khác, bên trong có `ResultTitleText`, `ResultScoreText` và 2 Button: `Chơi lại`, `Về menu`

### Bước 2: Script HUD

```csharp
using System.Collections;
using TMPro;
using UnityEngine;

// Hiển thị thông tin game và xử lý các nút bấm UI
public class HUD : MonoBehaviour
{
    [Header("Text")]
    [SerializeField] private TextMeshProUGUI scoreText;
    [SerializeField] private TextMeshProUGUI livesText;
    [SerializeField] private TextMeshProUGUI coinsText;
    [SerializeField] private TextMeshProUGUI timeText;
    [SerializeField] private TextMeshProUGUI messageText;

    [Header("Panels")]
    [SerializeField] private GameObject pausePanel;
    [SerializeField] private GameObject resultPanel;
    [SerializeField] private TextMeshProUGUI resultTitleText;
    [SerializeField] private TextMeshProUGUI resultScoreText;

    private GameManager gm;
    private Coroutine messageRoutine;

    void Start()
    {
        gm = GameManager.Instance;

        // Đăng ký lắng nghe event của GameManager
        gm.OnScoreChanged += UpdateScore;
        gm.OnLivesChanged += UpdateLives;
        gm.OnCoinsChanged += UpdateCoins;
        gm.OnStateChanged += HandleStateChanged;
        gm.OnMessage += ShowMessage;

        // Hiển thị giá trị ban đầu
        UpdateScore(gm.Score);
        UpdateLives(gm.Lives);
        UpdateCoins(gm.CoinsCollected, gm.TotalCoins);
        messageText.text = "";
        pausePanel.SetActive(false);
        resultPanel.SetActive(false);
    }

    void OnDestroy()
    {
        // Hủy đăng ký - tránh memory leak và lỗi khi load lại scene (Bài 1, phần 14)
        if (gm != null)
        {
            gm.OnScoreChanged -= UpdateScore;
            gm.OnLivesChanged -= UpdateLives;
            gm.OnCoinsChanged -= UpdateCoins;
            gm.OnStateChanged -= HandleStateChanged;
            gm.OnMessage -= ShowMessage;
        }
    }

    void Update()
    {
        // Thời gian thay đổi liên tục nên cập nhật mỗi frame thay vì dùng event
        int seconds = Mathf.CeilToInt(gm.TimeRemaining);
        timeText.text = $"{seconds / 60:00}:{seconds % 60:00}";
    }

    void UpdateScore(int score)
    {
        scoreText.text = $"Điểm: {score}";
    }

    void UpdateLives(int lives)
    {
        livesText.text = $"Mạng: {lives}";
    }

    void UpdateCoins(int collected, int total)
    {
        coinsText.text = $"Xu: {collected}/{total}";
    }

    void HandleStateChanged(GameState state)
    {
        pausePanel.SetActive(state == GameState.Paused);

        if (state == GameState.Won || state == GameState.Lost)
        {
            resultPanel.SetActive(true);
            resultTitleText.text = state == GameState.Won ? "CHIẾN THẮNG!" : "THUA RỒI!";

            int highScore = PlayerPrefs.GetInt("HighScore", 0);
            resultScoreText.text = $"Điểm: {gm.Score}\nKỷ lục: {highScore}";
        }
    }

    void ShowMessage(string message)
    {
        // Dừng thông báo cũ (nếu có) trước khi hiện thông báo mới
        if (messageRoutine != null)
        {
            StopCoroutine(messageRoutine);
        }
        messageRoutine = StartCoroutine(MessageRoutine(message));
    }

    IEnumerator MessageRoutine(string message)
    {
        messageText.text = message;
        yield return new WaitForSeconds(2f);
        messageText.text = "";
    }

    // ===== Các hàm gắn vào Button → On Click () trong Inspector (Bài 5) =====

    public void OnResumeClicked()
    {
        gm.TogglePause();
    }

    public void OnRestartClicked()
    {
        gm.RestartLevel();
    }

    public void OnMenuClicked()
    {
        gm.LoadMenu();
    }
}
```

### Bước 3: Kết nối

1. Gắn `HUD` vào **Canvas**, kéo các Text và Panel vào đúng ô trong Inspector
2. Với mỗi Button: ở mục **On Click ()** bấm **+**, kéo **Canvas** vào ô object, chọn hàm:
   - `Tiếp tục` → `HUD.OnResumeClicked`
   - `Chơi lại` → `HUD.OnRestartClicked`
   - `Về menu` (cả 2 panel) → `HUD.OnMenuClicked`
3. Bấm Play: nhặt xu, để quái chạm vào, nhấn **Esc** để tạm dừng, chạm cờ khi chưa đủ xu...

## 🎬 12. Màn hình Main Menu

Tạo script `MainMenu.cs`:

```csharp
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;

// Màn hình menu chính
public class MainMenu : MonoBehaviour
{
    [SerializeField] private string gameSceneName = "Game";
    [SerializeField] private TextMeshProUGUI highScoreText;

    void Start()
    {
        Time.timeScale = 1f; // Đề phòng quay về từ màn hình đang dừng
        highScoreText.text = $"Kỷ lục: {PlayerPrefs.GetInt("HighScore", 0)}";
    }

    public void OnPlayClicked()
    {
        SceneManager.LoadScene(gameSceneName);
    }

    public void OnQuitClicked()
    {
        Debug.Log("Thoát game"); // Application.Quit không có tác dụng trong Editor
        Application.Quit();
    }
}
```

Setup scene **MainMenu**:

1. Mở scene `MainMenu`, tạo **Canvas** (Scale With Screen Size như trên)
2. Thêm Text tiêu đề "COIN COLLECTOR", Text `HighScoreText`, 2 Button `Chơi` và `Thoát`. Có thể đặt 2 nút trong một object có **Vertical Layout Group** (Bài 5, phần 4)
3. Gắn `MainMenu` vào Canvas, kéo `HighScoreText` vào Inspector
4. Nút `Chơi` → `MainMenu.OnPlayClicked`, nút `Thoát` → `MainMenu.OnQuitClicked`
5. Bấm Play ở scene MainMenu để kiểm tra toàn bộ luồng: Menu → Game → Thắng/Thua → Về menu

## 🎭 13. Animation cho nhân vật (tùy chọn)

Nếu có sprite sheet nhân vật (vd: tải miễn phí ở [kenney.nl/assets](https://kenney.nl/assets)), bạn có thể thêm animation (Bài 6, phần 2):

1. Import sprite sheet → **Sprite Mode** = `Multiple` → **Sprite Editor → Slice**
2. Chọn `Player`, mở **Window → Animation → Animation** → **Create** → `Player_Idle.anim`. Kéo các frame đứng yên vào timeline
3. **Create New Clip** → `Player_Run.anim` (các frame chạy), `Player_Jump.anim` (frame nhảy)
4. Mở **Window → Animation → Animator**, tạo parameters: `Speed` (Float), `IsGrounded` (Bool) - đúng tên như trong `PlayerController2D`
5. Tạo transitions (bỏ tick **Has Exit Time**):
   - `Idle → Run`: `Speed > 0.1`; `Run → Idle`: `Speed < 0.1`
   - `Any State → Jump`: `IsGrounded = false`; `Jump → Idle`: `IsGrounded = true`

Không có sprite sheet? Script vẫn chạy bình thường vì `PlayerController2D` kiểm tra `animator != null`.

## ✅ 14. Kiểm thử và sửa lỗi

### Danh sách test

- [ ] Chạy trái/phải, nhảy được; không nhảy được khi đang ở trên không
- [ ] Nhặt xu: điểm tăng, số xu tăng, có âm thanh
- [ ] Chạm quái hoặc rơi xuống vực: mất 1 mạng, hồi sinh ở SpawnPoint, nhấp nháy
- [ ] Hết mạng → màn hình "THUA RỒI!"
- [ ] Hết giờ → màn hình "THUA RỒI!"
- [ ] Chạm cờ khi chưa đủ xu → hiện thông báo; đủ xu → "CHIẾN THẮNG!" và có điểm thưởng thời gian
- [ ] Esc tạm dừng/tiếp tục; nhạc nền dừng/tiếp tục theo
- [ ] "Chơi lại" đưa mọi thứ về ban đầu; "Về menu" hiện đúng kỷ lục

### Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách sửa |
| --- | --- | --- |
| `InvalidOperationException: You are trying to read Input...` | Project chỉ bật Input System mới | Active Input Handling = **Both** (phần 2) |
| Nhân vật không nhảy được | Bục chưa ở layer `Ground`, hoặc **Ground Layer** trong Inspector chưa chọn | Kiểm tra Layer của bục và ô Ground Layer; xem vòng Gizmo xanh có chạm mặt đất không |
| Nhân vật dính vào cạnh tường | Ma sát | Gán Physics Material 2D `NoFriction` |
| Xu/quái/cờ không phản ứng | Collider chưa bật **Is Trigger**, sai Tag, hoặc dùng nhầm Collider 3D | Dùng `...Collider2D`, bật Is Trigger, Player có tag `Player` (Bài 3, phần 8) |
| `NullReferenceException` ở `GameManager.Instance` | Scene chưa có object `GameManager` | Thêm GameManager vào scene Game |
| `NullReferenceException` trong HUD/Player | Quên kéo reference vào Inspector | Kiểm tra các ô còn "None" trong Inspector |
| "Scene couldn't be loaded" | Scene chưa có trong Build Profiles/Build Settings | Thêm cả MainMenu và Game (phần 2) |
| Chữ tiếng Việt hiện ô vuông | Font TMP mặc định thiếu ký tự | Tạo Font Asset **Dynamic** từ font hỗ trợ tiếng Việt: chuột phải file `.ttf` → **Create → TextMeshPro → Font Asset** |
| Chơi lại thì game đứng yên | `Time.timeScale` vẫn là 0 | `GameManager.Awake` và `MainMenu.Start` đã đặt lại `Time.timeScale = 1f` - kiểm tra bạn không bỏ sót dòng này |

## 🚀 15. Build và chia sẻ game

### Build WebGL

1. **File → Build Profiles** (Unity 2022: **File → Build Settings**) → chọn **Web** / **WebGL** → **Switch Platform** (cài module WebGL qua Unity Hub nếu chưa có)
2. Kiểm tra danh sách scene: `MainMenu` (0), `Game` (1)
3. **Player Settings → Publishing Settings**: bật **Decompression Fallback** (tránh lỗi khi upload lên itch.io)
4. Bấm **Build**, chọn thư mục `Builds/WebGL`

### Đăng lên itch.io

1. Nén **nội dung** thư mục build (file `index.html` phải nằm ở gốc file zip)
2. Tạo tài khoản [itch.io](https://itch.io) → **Upload new project**
3. **Kind of project** = `HTML`, upload file zip, tick **This file will be played in the browser**
4. Chỉnh kích thước khung game (vd `960 x 540`), bấm **Save** → chia sẻ link cho bạn bè!

> 💡 Muốn build cho Windows/Mac/Linux: chọn platform tương ứng trong Build Profiles, hoặc dùng build script ở Bài 7, phần 9.

## 🎮 Bài tập mở rộng

### Bài tập 1: Giẫm đầu quái

- Nếu nhân vật rơi xuống và chạm **phần trên** của quái (vận tốc Y < 0 và vị trí cao hơn quái) thì quái bị tiêu diệt, nhân vật nảy lên, được cộng điểm
- Gợi ý: so sánh `rb.linearVelocity.y` và `transform.position.y` trong `OnTriggerStay2D`

### Bài tập 2: Cảm giác điều khiển tốt hơn (Bài 3, Bài 4)

- **Coyote time**: vẫn nhảy được trong 0.1 giây sau khi rời bục
- **Jump buffer**: nhấn Space sớm một chút trước khi chạm đất vẫn nhảy
- **Nhảy cao/thấp**: thả Space sớm thì nhảy thấp hơn

### Bài tập 3: Nhiều màn chơi (Bài 2, Bài 5)

- Tạo `Level2`, `Level3`; khi thắng có nút "Màn tiếp theo"
- Tạo ScriptableObject `LevelData` (tên màn, thời gian, tên scene) để mỗi màn có thông số riêng
- Lưu màn cao nhất đã mở khóa bằng `PlayerPrefs`

### Bài tập 4: Settings menu (Bài 5, Bài 6)

- Slider chỉnh âm lượng nhạc/hiệu ứng bằng **Audio Mixer**
- Nút xóa kỷ lục (`PlayerPrefs.DeleteKey("HighScore")`)

### Bài tập 5: Hiệu ứng và tối ưu (Bài 2, Bài 7)

- Hiệu ứng lấp lánh (Particle System) khi nhặt xu, dùng **Object Pooling** thay vì `Instantiate`/`Destroy`
- Bục di chuyển (moving platform) và bục biến mất sau khi đứng lên
- Chuyển input sang **Input System** mới (Bài 4, phần 2)

## ✅ Checklist hoàn thành

- [ ] Tạo được project, thư mục, tag, layer và 2 scene
- [ ] Nhân vật di chuyển, nhảy, hồi sinh đúng
- [ ] Camera đi theo nhân vật mượt mà
- [ ] Dùng ScriptableObject `GameSettings` để chỉnh thông số không cần sửa code
- [ ] GameManager quản lý điểm, mạng, thời gian, thắng/thua qua event
- [ ] Xu, quái, vực, cờ hoạt động bằng trigger 2D
- [ ] Có nhạc nền và hiệu ứng âm thanh
- [ ] HUD, menu tạm dừng, màn hình kết quả và Main Menu hoạt động
- [ ] Kỷ lục được lưu giữa các lần chơi
- [ ] Build được game và chia sẻ link
- [ ] Hoàn thành ít nhất 2 bài tập mở rộng

## 🚀 Tiếp theo

🎉 Chúc mừng! Bạn đã tự làm một game hoàn chỉnh từ con số 0 - đây là cột mốc quan trọng nhất của người mới học Unity. Giờ bạn có thể:

- Tự lên kế hoạch và chia nhỏ một game thành các script/prefab
- Kết hợp Physics, Input, UI, Audio, Animation trong cùng một project
- Tìm và sửa lỗi thường gặp trong Unity
- Build và chia sẻ game cho người khác chơi

**Bài tiếp theo**: Bạn đã hoàn thành khóa học! Xem lại **Lộ trình phát triển tiếp theo** ở [Bài 7 - Resources & Best Practices](./07-resources.md) hoặc quay về [Mục lục khóa học](./README.md).

---

💡 **Tips**:

- **Hoàn thành > Hoàn hảo** - Một game nhỏ làm xong có giá trị hơn một game lớn bỏ dở
- **Test sau mỗi bước** - Lỗi phát hiện sớm dễ sửa hơn nhiều
- **Commit Git thường xuyên** - Mạnh dạn thử nghiệm vì luôn có thể quay lại
- **Cho người khác chơi thử** - Bạn sẽ bất ngờ với những gì họ tìm ra
- **Tham gia game jam** - Cách nhanh nhất để lên trình sau khóa học này
