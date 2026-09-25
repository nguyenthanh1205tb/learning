# 📚 Bài 7: Resources & Best Practices - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Tìm hiểu các tài nguyên học Unity chính thức và nâng cao
- Biết cách sử dụng Unity Documentation và Profiler hiệu quả
- Khám phá cộng đồng Unity và các kênh học tập chuyên nghiệp
- Nắm vững Design Patterns và Architecture patterns
- Thành thạo Performance Optimization và Profiling
- Chuẩn bị cho việc phát triển game thực tế với best practices
- Sử dụng Git và Version Control chuyên nghiệp

## 🎓 1. Tài nguyên học tập chính thức và nâng cao

### Unity Learn - Khóa học miễn phí

**Website**: [learn.unity.com](https://learn.unity.com)

#### Khóa học được khuyến nghị:

- **Junior Programmer Pathway** - Lộ trình lập trình viên Unity
- **Creative Core** - Thiết kế game và nghệ thuật
- **2D Game Development** - Phát triển game 2D
- **3D Game Development** - Phát triển game 3D
- **VR Development** - Phát triển VR/AR
- **Advanced Scripting** - Scripting nâng cao
- **Performance Optimization** - Tối ưu performance

#### Cách học hiệu quả:

```csharp
// Ví dụ từ Unity Learn - Player Movement với best practices
public class PlayerController : MonoBehaviour
{
    [Header("Movement Settings")]
    public float speed = 5f;
    public float jumpForce = 10f;

    private Rigidbody rb;
    private bool isGrounded;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void FixedUpdate()
    {
        float moveHorizontal = Input.GetAxis("Horizontal");
        float moveVertical = Input.GetAxis("Vertical");

        Vector3 movement = new Vector3(moveHorizontal, 0.0f, moveVertical);
        rb.AddForce(movement * speed);
    }
}
```

### Unity Documentation

**Website**: [docs.unity3d.com](https://docs.unity3d.com)

#### Cách sử dụng hiệu quả:

1. **API Reference** - Tìm hiểu chi tiết về các class và method
2. **Manual** - Hướng dẫn sử dụng các tính năng
3. **Scripting Reference** - Ví dụ code và best practices
4. **Tutorials** - Hướng dẫn step-by-step
5. **Performance Guidelines** - Tối ưu performance

#### Ví dụ tìm kiếm:

- `MonoBehaviour` - Tìm hiểu về base class
- `Rigidbody` - Physics system
- `Input` - Input handling
- `Transform` - Position, rotation, scale
- `Profiler` - Performance analysis

### Unity Forum

**Website**: [forum.unity.com](https://forum.unity.com)

#### Các section quan trọng:

- **Unity** - Câu hỏi chung về Unity
- **Scripting** - Hỏi đáp về lập trình
- **2D/3D** - Phát triển game 2D/3D
- **Mobile** - Phát triển mobile games
- **Graphics** - Rendering và visual effects
- **Performance** - Optimization và profiling

## 🌐 2. Cộng đồng và kênh học tập chuyên nghiệp

### YouTube Channels (Tiếng Anh)

- **Brackeys** - Tutorials từ cơ bản đến nâng cao
- **Code Monkey** - Advanced Unity techniques
- **GameDevHQ** - Game development tips
- **Unity** - Official Unity channel
- **Dani** - Fun game development
- **Jason Weimann** - Advanced Unity programming
- **Sebastian Lague** - Algorithm và procedural generation

### YouTube Channels (Tiếng Việt)

- **Unity Việt Nam** - Cộng đồng Unity Việt Nam
- **GameDev Việt Nam** - Phát triển game
- **Code Dạo** - Lập trình và game dev

### Discord Communities

- **Unity Discord** - Official Unity community
- **GameDev League** - Game development community
- **Unity Việt Nam Discord** - Cộng đồng Việt Nam

### Reddit Communities

- **r/Unity3D** - Unity development
- **r/gamedev** - Game development
- **r/learnprogramming** - Học lập trình
- **r/programming** - Programming discussions

## 🛒 3. Asset Stores và Resources

### Unity Asset Store

**Website**: [assetstore.unity.com](https://assetstore.unity.com)

#### Các loại assets miễn phí:

- **Standard Assets** - Assets cơ bản của Unity
- **2D Game Kit** - Template game 2D
- **3D Game Kit** - Template game 3D
- **TextMeshPro** - Text rendering nâng cao
- **Post Processing Stack** - Visual effects

#### Assets trả phí chất lượng:

- **Character Controller** - Player movement
- **UI Systems** - Menu và HUD
- **Audio Tools** - Audio management
- **Visual Effects** - Particles và effects

### Free Resources

- **OpenGameArt.org** - Sprites và graphics miễn phí
- **Freesound.org** - Âm thanh miễn phí
- **Pixabay** - Images và videos
- **Unsplash** - High-quality photos

### Paid Resources

- **Adobe Creative Suite** - Photoshop, Illustrator
- **Blender** - 3D modeling (miễn phí)
- **Maya/3ds Max** - 3D modeling chuyên nghiệp
- **Audacity** - Audio editing (miễn phí)

## 🏗️ 4. Design Patterns và Architecture

### Singleton Pattern

```csharp
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Game Settings")]
    public int score = 0;
    public int lives = 3;
    public bool isGamePaused = false;

    void Awake()
    {
        // Singleton pattern
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public void AddScore(int points)
    {
        score += points;
        Debug.Log($"Score: {score}");
    }

    public void PauseGame()
    {
        isGamePaused = true;
        Time.timeScale = 0f;
    }

    public void ResumeGame()
    {
        isGamePaused = false;
        Time.timeScale = 1f;
    }
}
```

### Observer Pattern

```csharp
public class GameEvents : MonoBehaviour
{
    public static GameEvents Instance { get; private set; }

    // Events
    public event Action<int> OnScoreChanged;
    public event Action<int> OnLivesChanged;
    public event Action OnGameOver;
    public event Action OnGamePaused;
    public event Action OnGameResumed;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public void TriggerScoreChanged(int newScore)
    {
        OnScoreChanged?.Invoke(newScore);
    }

    public void TriggerLivesChanged(int newLives)
    {
        OnLivesChanged?.Invoke(newLives);
    }

    public void TriggerGameOver()
    {
        OnGameOver?.Invoke();
    }

    public void TriggerGamePaused()
    {
        OnGamePaused?.Invoke();
    }

    public void TriggerGameResumed()
    {
        OnGameResumed?.Invoke();
    }
}

// Sử dụng Observer Pattern
public class UIManager : MonoBehaviour
{
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI livesText;

    void Start()
    {
        // Subscribe to events
        GameEvents.Instance.OnScoreChanged += UpdateScoreDisplay;
        GameEvents.Instance.OnLivesChanged += UpdateLivesDisplay;
        GameEvents.Instance.OnGameOver += ShowGameOverScreen;
    }

    void OnDestroy()
    {
        // Unsubscribe from events
        if (GameEvents.Instance != null)
        {
            GameEvents.Instance.OnScoreChanged -= UpdateScoreDisplay;
            GameEvents.Instance.OnLivesChanged -= UpdateLivesDisplay;
            GameEvents.Instance.OnGameOver -= ShowGameOverScreen;
        }
    }

    void UpdateScoreDisplay(int score)
    {
        scoreText.text = $"Score: {score}";
    }

    void UpdateLivesDisplay(int lives)
    {
        livesText.text = $"Lives: {lives}";
    }

    void ShowGameOverScreen()
    {
        Debug.Log("Game Over!");
    }
}
```

### State Machine Pattern

```csharp
public enum GameState
{
    MainMenu,
    Playing,
    Paused,
    GameOver,
    Settings
}

public class GameStateManager : MonoBehaviour
{
    public static GameStateManager Instance { get; private set; }

    public GameState CurrentState { get; private set; }

    // State change event
    public event Action<GameState, GameState> OnStateChanged;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void Start()
    {
        ChangeState(GameState.MainMenu);
    }

    public void ChangeState(GameState newState)
    {
        GameState previousState = CurrentState;
        CurrentState = newState;

        OnStateChanged?.Invoke(previousState, newState);

        HandleStateChange(previousState, newState);
    }

    void HandleStateChange(GameState from, GameState to)
    {
        switch (to)
        {
            case GameState.MainMenu:
                Time.timeScale = 1f;
                break;
            case GameState.Playing:
                Time.timeScale = 1f;
                break;
            case GameState.Paused:
                Time.timeScale = 0f;
                break;
            case GameState.GameOver:
                Time.timeScale = 0f;
                break;
            case GameState.Settings:
                Time.timeScale = 0f;
                break;
        }

        Debug.Log($"State changed from {from} to {to}");
    }
}
```

### Object Pool Pattern

```csharp
public class ObjectPool<T> where T : Component
{
    private Queue<T> pool = new Queue<T>();
    private T prefab;
    private Transform parent;

    public ObjectPool(T prefab, int initialSize, Transform parent = null)
    {
        this.prefab = prefab;
        this.parent = parent;

        // Tạo trước objects
        for (int i = 0; i < initialSize; i++)
        {
            T obj = GameObject.Instantiate(prefab, parent);
            obj.gameObject.SetActive(false);
            pool.Enqueue(obj);
        }
    }

    public T Get()
    {
        if (pool.Count > 0)
        {
            T obj = pool.Dequeue();
            obj.gameObject.SetActive(true);
            return obj;
        }

        // Nếu hết objects, tạo thêm
        T newObj = GameObject.Instantiate(prefab, parent);
        return newObj;
    }

    public void Return(T obj)
    {
        obj.gameObject.SetActive(false);
        pool.Enqueue(obj);
    }
}

// Sử dụng Object Pool
public class BulletPool : MonoBehaviour
{
    public Bullet bulletPrefab;
    public int poolSize = 50;

    private ObjectPool<Bullet> bulletPool;

    void Start()
    {
        bulletPool = new ObjectPool<Bullet>(bulletPrefab, poolSize, transform);
    }

    public void FireBullet(Vector3 position, Vector3 direction)
    {
        Bullet bullet = bulletPool.Get();
        bullet.transform.position = position;
        bullet.transform.rotation = Quaternion.LookRotation(direction);
        bullet.SetDirection(direction);

        // Trả về pool sau 5 giây
        StartCoroutine(ReturnBulletAfterDelay(bullet, 5f));
    }

    IEnumerator ReturnBulletAfterDelay(Bullet bullet, float delay)
    {
        yield return new WaitForSeconds(delay);
        bulletPool.Return(bullet);
    }
}
```

## ⚡ 5. Performance Optimization

### Profiler Usage

```csharp
public class PerformanceProfiler : MonoBehaviour
{
    void Start()
    {
        // Enable profiling
        Profiler.enabled = true;

        // Start profiling
        Profiler.BeginSample("MyGameLogic");

        // Your game logic here
        PerformGameLogic();

        // End profiling
        Profiler.EndSample();
    }

    void PerformGameLogic()
    {
        // Simulate game logic
        for (int i = 0; i < 1000; i++)
        {
            // Some computation
            Mathf.Sin(i * 0.01f);
        }
    }

    void Update()
    {
        // Profile Update method
        Profiler.BeginSample("Update");

        // Update logic
        HandleInput();
        UpdateGameState();

        Profiler.EndSample();
    }

    void HandleInput()
    {
        Profiler.BeginSample("HandleInput");

        if (Input.GetKeyDown(KeyCode.Space))
        {
            // Input handling
        }

        Profiler.EndSample();
    }

    void UpdateGameState()
    {
        Profiler.BeginSample("UpdateGameState");

        // Game state updates
        UpdatePlayerPosition();
        UpdateEnemies();

        Profiler.EndSample();
    }

    void UpdatePlayerPosition()
    {
        // Player position logic
    }

    void UpdateEnemies()
    {
        // Enemy update logic
    }
}
```

### Memory Optimization

```csharp
public class MemoryOptimizer : MonoBehaviour
{
    // ✅ Tốt - Cache references
    private Transform cachedTransform;
    private Rigidbody cachedRigidbody;
    private Renderer cachedRenderer;

    // ✅ Tốt - Object pooling
    private Queue<GameObject> objectPool = new Queue<GameObject>();

    // ✅ Tốt - Reuse collections
    private List<GameObject> tempList = new List<GameObject>();

    void Start()
    {
        // Cache references một lần
        cachedTransform = transform;
        cachedRigidbody = GetComponent<Rigidbody>();
        cachedRenderer = GetComponent<Renderer>();

        // Initialize object pool
        InitializeObjectPool();
    }

    void InitializeObjectPool()
    {
        for (int i = 0; i < 100; i++)
        {
            GameObject obj = new GameObject($"PooledObject_{i}");
            obj.SetActive(false);
            objectPool.Enqueue(obj);
        }
    }

    void Update()
    {
        // ✅ Tốt - Sử dụng cached references
        cachedTransform.position += Vector3.forward * Time.deltaTime;

        // ✅ Tốt - Reuse collections
        tempList.Clear();
        tempList.AddRange(FindObjectsOfType<GameObject>());

        // Process tempList
        foreach (GameObject obj in tempList)
        {
            // Process object
        }
    }

    GameObject GetPooledObject()
    {
        if (objectPool.Count > 0)
        {
            GameObject obj = objectPool.Dequeue();
            obj.SetActive(true);
            return obj;
        }

        // Create new object if pool is empty
        return new GameObject("NewObject");
    }

    void ReturnPooledObject(GameObject obj)
    {
        obj.SetActive(false);
        objectPool.Enqueue(obj);
    }
}
```

### Rendering Optimization

```csharp
public class RenderingOptimizer : MonoBehaviour
{
    [Header("LOD Settings")]
    public float[] lodDistances = { 10f, 25f, 50f };
    public GameObject[] lodObjects;

    [Header("Culling Settings")]
    public float cullDistance = 100f;

    private Transform playerTransform;
    private List<Renderer> renderers = new List<Renderer>();

    void Start()
    {
        playerTransform = Camera.main.transform;

        // Find all renderers
        renderers.AddRange(FindObjectsOfType<Renderer>());
    }

    void Update()
    {
        // Frustum culling
        PerformFrustumCulling();

        // Distance culling
        PerformDistanceCulling();

        // LOD system
        UpdateLOD();
    }

    void PerformFrustumCulling()
    {
        Plane[] frustumPlanes = GeometryUtility.CalculateFrustumPlanes(Camera.main);

        foreach (Renderer renderer in renderers)
        {
            if (renderer != null)
            {
                bool isVisible = GeometryUtility.TestPlanesAABB(frustumPlanes, renderer.bounds);
                renderer.enabled = isVisible;
            }
        }
    }

    void PerformDistanceCulling()
    {
        foreach (Renderer renderer in renderers)
        {
            if (renderer != null)
            {
                float distance = Vector3.Distance(playerTransform.position, renderer.transform.position);
                renderer.enabled = distance <= cullDistance;
            }
        }
    }

    void UpdateLOD()
    {
        for (int i = 0; i < lodObjects.Length; i++)
        {
            if (lodObjects[i] != null)
            {
                float distance = Vector3.Distance(playerTransform.position, lodObjects[i].transform.position);

                if (distance <= lodDistances[0])
                {
                    // High quality
                    lodObjects[i].SetActive(true);
                }
                else if (distance <= lodDistances[1])
                {
                    // Medium quality
                    lodObjects[i].SetActive(true);
                }
                else if (distance <= lodDistances[2])
                {
                    // Low quality
                    lodObjects[i].SetActive(true);
                }
                else
                {
                    // Culled
                    lodObjects[i].SetActive(false);
                }
            }
        }
    }
}
```

## 💡 6. Best Practices chi tiết

### Code Organization

```csharp
// ✅ Tốt - Tổ chức code rõ ràng
public class PlayerController : MonoBehaviour
{
    [Header("Movement Settings")]
    public float moveSpeed = 5f;
    public float jumpForce = 10f;

    [Header("Audio")]
    public AudioClip jumpSound;
    public AudioClip walkSound;

    private Rigidbody rb;
    private bool isGrounded;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        HandleInput();
    }

    void HandleInput()
    {
        // Input logic
    }
}

// ❌ Tồi - Code không tổ chức
public class BadPlayerController : MonoBehaviour
{
    public float moveSpeed = 5f;
    public float jumpForce = 10f;
    public AudioClip jumpSound;
    public AudioClip walkSound;
    private Rigidbody rb;
    private bool isGrounded;

    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        if (Input.GetKey(KeyCode.W))
        {
            rb.AddForce(Vector3.forward * moveSpeed);
        }
        if (Input.GetKeyDown(KeyCode.Space))
        {
            rb.AddForce(Vector3.up * jumpForce);
        }
    }
}
```

### Performance Tips

```csharp
// ✅ Tốt - Cache references
public class OptimizedScript : MonoBehaviour
{
    private Transform playerTransform;
    private Rigidbody playerRigidbody;

    void Start()
    {
        // Cache references một lần
        playerTransform = transform;
        playerRigidbody = GetComponent<Rigidbody>();
    }

    void Update()
    {
        // Sử dụng cached references
        playerTransform.position += Vector3.forward * Time.deltaTime;
    }
}

// ❌ Tồi - Tìm kiếm mỗi frame
public class UnoptimizedScript : MonoBehaviour
{
    void Update()
    {
        // Tìm kiếm mỗi frame - rất chậm!
        Transform playerTransform = GameObject.Find("Player").transform;
        playerTransform.position += Vector3.forward * Time.deltaTime;
    }
}
```

### Memory Management

```csharp
// ✅ Tốt - Quản lý memory
public class MemoryManager : MonoBehaviour
{
    private List<GameObject> spawnedObjects = new List<GameObject>();

    void SpawnObject()
    {
        GameObject obj = Instantiate(prefab);
        spawnedObjects.Add(obj);
    }

    void CleanupObjects()
    {
        foreach (GameObject obj in spawnedObjects)
        {
            if (obj != null)
            {
                Destroy(obj);
            }
        }
        spawnedObjects.Clear();
    }

    void OnDestroy()
    {
        CleanupObjects();
    }
}

// ❌ Tồi - Memory leak
public class BadMemoryManager : MonoBehaviour
{
    void SpawnObject()
    {
        GameObject obj = Instantiate(prefab);
        // Không lưu reference - không thể cleanup
    }
}
```

### Error Handling

```csharp
// ✅ Tốt - Error handling
public class SafeScript : MonoBehaviour
{
    public GameObject target;

    void Start()
    {
        if (target == null)
        {
            Debug.LogError("Target is not assigned!");
            return;
        }

        // Safe to use target
        target.SetActive(true);
    }

    void Update()
    {
        if (target != null)
        {
            // Safe operation
            float distance = Vector3.Distance(transform.position, target.transform.position);
        }
    }
}

// ❌ Tồi - Không kiểm tra null
public class UnsafeScript : MonoBehaviour
{
    public GameObject target;

    void Start()
    {
        // Có thể gây NullReferenceException
        target.SetActive(true);
    }
}
```

## ⚠️ 7. Common Mistakes để tránh

### 1. Null Reference Exceptions

```csharp
// ❌ Sai - Không kiểm tra null
public class BadExample : MonoBehaviour
{
    public GameObject player;

    void Start()
    {
        player.SetActive(true); // Có thể crash!
    }
}

// ✅ Đúng - Kiểm tra null
public class GoodExample : MonoBehaviour
{
    public GameObject player;

    void Start()
    {
        if (player != null)
        {
            player.SetActive(true);
        }
        else
        {
            Debug.LogError("Player is not assigned!");
        }
    }
}
```

### 2. Performance Issues

```csharp
// ❌ Sai - Tìm kiếm mỗi frame
void Update()
{
    GameObject player = GameObject.Find("Player");
    // Rất chậm!
}

// ✅ Đúng - Cache reference
private GameObject player;

void Start()
{
    player = GameObject.Find("Player");
}

void Update()
{
    // Sử dụng cached reference
}
```

### 3. Memory Leaks

```csharp
// ❌ Sai - Không cleanup
void SpawnEnemies()
{
    for (int i = 0; i < 100; i++)
    {
        GameObject enemy = Instantiate(enemyPrefab);
        // Không lưu reference để cleanup
    }
}

// ✅ Đúng - Cleanup
private List<GameObject> enemies = new List<GameObject>();

void SpawnEnemies()
{
    for (int i = 0; i < 100; i++)
    {
        GameObject enemy = Instantiate(enemyPrefab);
        enemies.Add(enemy);
    }
}

void CleanupEnemies()
{
    foreach (GameObject enemy in enemies)
    {
        if (enemy != null)
        {
            Destroy(enemy);
        }
    }
    enemies.Clear();
}
```

### 4. Incorrect Input Handling

```csharp
// ❌ Sai - Input trong FixedUpdate
void FixedUpdate()
{
    if (Input.GetKeyDown(KeyCode.Space))
    {
        Jump(); // Có thể miss input!
    }
}

// ✅ Đúng - Input trong Update
void Update()
{
    if (Input.GetKeyDown(KeyCode.Space))
    {
        Jump();
    }
}

void FixedUpdate()
{
    // Chỉ physics trong FixedUpdate
    HandlePhysics();
}
```

### 5. Poor Scene Organization

```csharp
// ❌ Sai - Không tổ chức Hierarchy
// Tất cả objects ở root level

// ✅ Đúng - Tổ chức Hierarchy
/*
Scene
├── Environment
│   ├── Ground
│   ├── Walls
│   └── Props
├── Player
│   ├── Body
│   ├── Head
│   └── Weapons
├── Enemies
│   ├── Enemy1
│   └── Enemy2
└── UI
    ├── Canvas
    └── EventSystem
*/
```

## 🔧 8. Git và Version Control

### Git Setup

```bash
# Khởi tạo Git repository
git init

# Tạo .gitignore cho Unity
echo "Library/
Temp/
Obj/
Build/
Builds/
Assets/AssetStoreTools*
.vs/
.vscode/
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db" > .gitignore

# Commit code
git add .
git commit -m "Initial commit"
```

### Git Workflow

```bash
# Tạo branch mới
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "Add new feature"

# Push branch
git push origin feature/new-feature

# Merge branch
git checkout main
git merge feature/new-feature

# Delete branch
git branch -d feature/new-feature
```

### Git Best Practices

```bash
# Commit messages
git commit -m "feat: add player movement system"
git commit -m "fix: resolve collision detection bug"
git commit -m "docs: update README with installation steps"
git commit -m "refactor: optimize enemy AI performance"

# Branch naming
feature/player-controller
bugfix/collision-detection
hotfix/critical-bug
release/v1.0.0

# Tagging releases
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## 🚀 9. Build và Deployment

### Build Settings

```csharp
// Build script
using UnityEngine;
using UnityEditor;

public class BuildScript
{
    [MenuItem("Build/Build All")]
    static void BuildAll()
    {
        BuildWindows();
        BuildMac();
        BuildLinux();
    }

    static void BuildWindows()
    {
        BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions();
        buildPlayerOptions.scenes = new[] { "Assets/Scenes/MainMenu.unity", "Assets/Scenes/Game.unity" };
        buildPlayerOptions.locationPathName = "Builds/Windows/MyGame.exe";
        buildPlayerOptions.target = BuildTarget.StandaloneWindows;
        buildPlayerOptions.options = BuildOptions.None;

        BuildPipeline.BuildPlayer(buildPlayerOptions);
    }

    static void BuildMac()
    {
        BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions();
        buildPlayerOptions.scenes = new[] { "Assets/Scenes/MainMenu.unity", "Assets/Scenes/Game.unity" };
        buildPlayerOptions.locationPathName = "Builds/Mac/MyGame.app";
        buildPlayerOptions.target = BuildTarget.StandaloneOSX;
        buildPlayerOptions.options = BuildOptions.None;

        BuildPipeline.BuildPlayer(buildPlayerOptions);
    }

    static void BuildLinux()
    {
        BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions();
        buildPlayerOptions.scenes = new[] { "Assets/Scenes/MainMenu.unity", "Assets/Scenes/Game.unity" };
        buildPlayerOptions.locationPathName = "Builds/Linux/MyGame";
        buildPlayerOptions.target = BuildTarget.StandaloneLinux64;
        buildPlayerOptions.options = BuildOptions.None;

        BuildPipeline.BuildPlayer(buildPlayerOptions);
    }
}
```

### Publishing Platforms

- **itch.io** - Indie game platform
- **Steam** - PC gaming platform
- **Google Play Store** - Android games
- **Apple App Store** - iOS games
- **WebGL** - Browser games

## 📈 10. Lộ trình phát triển tiếp theo

### Sau khi hoàn thành khóa học:

1. **Tạo game đầu tiên** - 2D platformer đơn giản
2. **Học thêm về**:
   - Shader programming
   - Advanced physics
   - Networking (Multiplayer)
   - Mobile optimization
   - VR/AR development

### Các kỹ năng nâng cao:

- **Design Patterns** - Singleton, Observer, State Machine
- **Architecture** - MVC, ECS (Entity Component System)
- **Performance** - Profiling, Optimization
- **Testing** - Unit testing, Integration testing

### Cộng đồng và Networking:

- Tham gia game jams
- Đóng góp open source projects
- Tham gia conferences và meetups
- Tạo portfolio và demo reel

## 🎮 Bài tập cuối khóa

### Dự án: Tạo game hoàn chỉnh

Tạo một game 2D platformer với các tính năng:

1. **Player Controller**:

   - Di chuyển trái/phải
   - Nhảy
   - Animation

2. **Enemy System**:

   - Enemy AI đơn giản
   - Collision detection
   - Health system

3. **UI System**:

   - Main menu
   - Game HUD
   - Game over screen

4. **Audio System**:

   - Background music
   - Sound effects

5. **Level Design**:
   - Platforms
   - Collectibles
   - Goal

### Checklist hoàn thành:

- [ ] Game có thể chạy từ đầu đến cuối
- [ ] Không có lỗi nghiêm trọng
- [ ] UI responsive và đẹp
- [ ] Audio hoạt động tốt
- [ ] Code được tổ chức rõ ràng
- [ ] Có thể build và chạy trên platform khác
- [ ] Sử dụng Design Patterns
- [ ] Performance optimization
- [ ] Git version control

## ✅ Checklist hoàn thành khóa học

- [ ] Hoàn thành tất cả 6 bài học trước
- [ ] Hiểu các tài nguyên học tập chính thức
- [ ] Biết cách sử dụng Unity Documentation và Profiler
- [ ] Tham gia cộng đồng Unity
- [ ] Nắm vững Design Patterns và Architecture
- [ ] Thành thạo Performance Optimization
- [ ] Sử dụng Git và Version Control
- [ ] Tránh được common mistakes
- [ ] Hoàn thành dự án cuối khóa
- [ ] Có thể tạo game đơn giản hoàn chỉnh

## 🎉 Chúc mừng!

Bạn đã hoàn thành khóa học Unity cơ bản VÀ nâng cao! Bây giờ bạn có đủ kiến thức để:

- Tạo game 2D/3D đơn giản
- Hiểu cách Unity hoạt động
- Sử dụng các công cụ Unity hiệu quả
- Áp dụng Design Patterns và best practices
- Optimize performance và debug issues
- Sử dụng Git cho version control
- Tiếp tục học các kỹ năng nâng cao

### Bước tiếp theo:

1. **Thực hành** - Tạo nhiều game nhỏ
2. **Học nâng cao** - Shaders, Networking, VR
3. **Tham gia cộng đồng** - Game jams, forums
4. **Tạo portfolio** - Showcase các dự án của bạn

---

💡 **Lời khuyên cuối**:

- **Thực hành là chìa khóa** - Code mỗi ngày
- **Đừng sợ lỗi** - Lỗi giúp bạn học hỏi
- **Tham gia cộng đồng** - Học từ người khác
- **Tạo game hoàn chỉnh** - Từ ý tưởng đến release
- **Sử dụng Design Patterns** - Code maintainable và scalable
- **Optimize performance** - Game mượt mà và responsive

**Chúc bạn thành công trên con đường phát triển game! 🎮✨**
