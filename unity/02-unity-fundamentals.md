# 🎮 Bài 2: Unity Fundamentals - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Hiểu GameObject và Component pattern sâu sắc
- Thành thạo Transform (position, rotation, scale)
- Biết cách sử dụng Scene và Hierarchy hiệu quả
- Hiểu Prefab và Instantiate với best practices
- Sử dụng Tag và Layer chuyên nghiệp
- Thành thạo Singleton Pattern và DontDestroyOnLoad
- Hiểu Object Pooling để tối ưu performance
- Sử dụng ScriptableObject cho data management

## 🏗️ 1. GameObject - Nền tảng của Unity

### GameObject là gì?

**GameObject** là **container** chứa tất cả mọi thứ trong Unity. Mọi thứ bạn thấy trong game đều là GameObject:

- **Player, Enemy, Bullet** - Game objects
- **Camera, Light, UI Elements** - System objects
- **Empty objects** - Để tổ chức code và hierarchy

### Tại sao Unity dùng GameObject?

Unity sử dụng **Entity-Component-System (ECS)** pattern:

- **Entity** = GameObject (chỉ là container)
- **Component** = Chức năng (Transform, Renderer, Script)
- **System** = Unity Engine (Physics, Rendering, Audio)

### Tạo GameObject

```csharp
public class GameObjectExample : MonoBehaviour
{
    void Start()
    {
        // Tạo GameObject mới
        GameObject newObject = new GameObject("MyNewObject");

        // Tạo GameObject với tên và vị trí
        GameObject player = new GameObject("Player");
        player.transform.position = new Vector3(0, 0, 0);

        // Tìm GameObject theo tên
        GameObject foundObject = GameObject.Find("Player");

        // Tìm GameObject theo tag
        GameObject playerByTag = GameObject.FindWithTag("Player");

        // Tìm tất cả GameObject có tag
        GameObject[] enemies = GameObject.FindGameObjectsWithTag("Enemy");
    }
}
```

### Quản lý GameObject

```csharp
public class ObjectManager : MonoBehaviour
{
    void Start()
    {
        GameObject player = GameObject.Find("Player");

        if (player != null)
        {
            // Kích hoạt/tắt GameObject
            player.SetActive(true);

            // Kiểm tra GameObject có active không
            if (player.activeInHierarchy)
            {
                Debug.Log("Player đang active!");
            }

            // Xóa GameObject
            // Destroy(player); // Xóa ngay lập tức
            // Destroy(player, 2f); // Xóa sau 2 giây
        }
    }
}
```

## 🔧 2. Component Pattern - Trái tim của Unity

### Component Pattern là gì?

**Component Pattern** là design pattern cho phép bạn **thêm chức năng** vào object mà không cần sửa code của object đó.

### Tại sao Unity dùng Component Pattern?

✅ **Ưu điểm**:

- **Flexibility**: Thêm/bỏ chức năng dễ dàng
- **Reusability**: Component có thể dùng cho nhiều GameObject
- **Modularity**: Mỗi component có trách nhiệm riêng
- **No inheritance hell**: Không cần kế thừa phức tạp

❌ **Nhược điểm**:

- **Performance**: Nhiều component = nhiều function calls
- **Coupling**: Component có thể phụ thuộc lẫn nhau
- **Debugging**: Khó debug khi có nhiều component

### Component là gì?

Component là **chức năng** được gắn vào GameObject. Một GameObject có thể có nhiều Component:

- **Transform** (bắt buộc) - Vị trí, xoay, tỷ lệ
- **Renderer** - Hiển thị hình ảnh
- **Collider** - Va chạm
- **Rigidbody** - Physics
- **Script** - Logic tùy chỉnh

### Thêm Component

```csharp
public class ComponentExample : MonoBehaviour
{
    void Start()
    {
        GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);

        // Thêm Component Rigidbody
        Rigidbody rb = cube.AddComponent<Rigidbody>();
        rb.mass = 2f;

        // Thêm Component AudioSource
        AudioSource audioSource = cube.AddComponent<AudioSource>();
        audioSource.volume = 0.5f;

        // Thêm Component tùy chỉnh
        PlayerController playerScript = cube.AddComponent<PlayerController>();
    }
}
```

### Lấy Component

```csharp
public class ComponentAccess : MonoBehaviour
{
    void Start()
    {
        // Lấy Component từ GameObject này
        Rigidbody rb = GetComponent<Rigidbody>();

        // Lấy Component từ GameObject khác
        GameObject player = GameObject.Find("Player");
        if (player != null)
        {
            PlayerController controller = player.GetComponent<PlayerController>();
        }

        // Lấy tất cả Component cùng loại
        Renderer[] renderers = GetComponents<Renderer>();

        // Lấy Component từ GameObject con
        Transform childTransform = GetComponentInChildren<Transform>();

        // Lấy Component từ GameObject cha
        Transform parentTransform = GetComponentInParent<Transform>();
    }
}
```

### Kiểm tra Component

```csharp
public class ComponentCheck : MonoBehaviour
{
    void Start()
    {
        // Kiểm tra có Component không
        if (GetComponent<Rigidbody>() != null)
        {
            Debug.Log("Có Rigidbody!");
        }

        // Cách ngắn gọn hơn với TryGetComponent
        if (TryGetComponent<Rigidbody>(out Rigidbody rb))
        {
            Debug.Log($"Rigidbody mass: {rb.mass}");
        }

        // Kiểm tra Component có active không
        if (GetComponent<Renderer>().enabled)
        {
            Debug.Log("Renderer đang bật!");
        }
    }
}
```

### Component Communication

```csharp
// Component A
public class HealthComponent : MonoBehaviour
{
    public int health = 100;

    public void TakeDamage(int damage)
    {
        health -= damage;
        Debug.Log($"Health: {health}");
    }
}

// Component B
public class DamageDealer : MonoBehaviour
{
    public int damage = 25;

    void OnTriggerEnter(Collider other)
    {
        // Lấy HealthComponent từ object khác
        HealthComponent health = other.GetComponent<HealthComponent>();
        if (health != null)
        {
            health.TakeDamage(damage);
        }
    }
}
```

## 📐 3. Transform - Vị trí, Xoay, Tỷ lệ

### Transform là gì?

Transform là Component **bắt buộc** của mọi GameObject. Nó quản lý:

- **Position**: Vị trí trong không gian 3D
- **Rotation**: Góc xoay (Euler angles hoặc Quaternion)
- **Scale**: Tỷ lệ phóng to/thu nhỏ

### Position - Vị trí

```csharp
public class PositionExample : MonoBehaviour
{
    void Start()
    {
        // Đặt vị trí tuyệt đối
        transform.position = new Vector3(5, 0, 3);

        // Di chuyển tương đối
        transform.Translate(Vector3.forward * 2f); // Tiến lên 2 đơn vị
        transform.Translate(Vector3.right * 1f);   // Sang phải 1 đơn vị

        // Di chuyển theo trục cụ thể
        transform.Translate(0, 1, 0); // Lên trên 1 đơn vị

        // Lấy vị trí hiện tại
        Vector3 currentPos = transform.position;
        Debug.Log($"Vị trí hiện tại: {currentPos}");
    }
}
```

### Rotation - Xoay

```csharp
public class RotationExample : MonoBehaviour
{
    void Start()
    {
        // Xoay bằng Euler angles (độ)
        transform.rotation = Quaternion.Euler(0, 90, 0); // Xoay 90 độ quanh trục Y

        // Xoay tương đối
        transform.Rotate(0, 45, 0); // Xoay thêm 45 độ quanh trục Y

        // Xoay quanh trục cụ thể
        transform.RotateAround(Vector3.zero, Vector3.up, 30f);

        // Xoay để nhìn vào một điểm
        Vector3 target = new Vector3(10, 0, 5);
        transform.LookAt(target);

        // Lấy góc xoay hiện tại
        Vector3 eulerAngles = transform.eulerAngles;
        Debug.Log($"Góc xoay: {eulerAngles}");
    }
}
```

### Scale - Tỷ lệ

```csharp
public class ScaleExample : MonoBehaviour
{
    void Start()
    {
        // Đặt tỷ lệ tuyệt đối
        transform.localScale = new Vector3(2, 2, 2); // Phóng to gấp đôi

        // Thay đổi tỷ lệ tương đối
        transform.localScale *= 1.5f; // Phóng to thêm 50%

        // Scale theo từng trục
        transform.localScale = new Vector3(1, 2, 1); // Cao gấp đôi

        // Lấy tỷ lệ hiện tại
        Vector3 currentScale = transform.localScale;
        Debug.Log($"Tỷ lệ hiện tại: {currentScale}");
    }
}
```

### Transform Utilities

```csharp
public class TransformUtils : MonoBehaviour
{
    void Start()
    {
        // Khoảng cách đến GameObject khác
        GameObject target = GameObject.Find("Target");
        if (target != null)
        {
            float distance = Vector3.Distance(transform.position, target.transform.position);
            Debug.Log($"Khoảng cách: {distance}");
        }

        // Hướng đến GameObject khác
        Vector3 direction = (target.transform.position - transform.position).normalized;

        // Di chuyển theo hướng
        transform.Translate(direction * 2f);

        // Reset transform về mặc định
        transform.position = Vector3.zero;
        transform.rotation = Quaternion.identity;
        transform.localScale = Vector3.one;
    }
}
```

## 🎬 4. Scene và Hierarchy

### Scene là gì?

Scene là **màn chơi** hoặc **level** trong game. Mỗi Scene chứa:

- Tất cả GameObject trong level đó
- Camera, Lighting, Audio settings
- UI Elements

### Hierarchy - Cây phân cấp

Hierarchy hiển thị tất cả GameObject trong Scene theo cấu trúc cây:

```
Scene
├── Main Camera
├── Directional Light
├── Player
│   ├── Body
│   ├── Head
│   └── Weapons
│       ├── Sword
│       └── Shield
├── Enemies
│   ├── Enemy1
│   └── Enemy2
└── Environment
    ├── Ground
    └── Walls
```

### Quản lý Hierarchy

```csharp
public class HierarchyManager : MonoBehaviour
{
    void Start()
    {
        // Tạo GameObject cha
        GameObject parent = new GameObject("Parent");

        // Tạo GameObject con
        GameObject child1 = new GameObject("Child1");
        GameObject child2 = new GameObject("Child2");

        // Đặt làm con của parent
        child1.transform.SetParent(parent.transform);
        child2.transform.SetParent(parent.transform);

        // Hoặc cách ngắn gọn
        GameObject child3 = new GameObject("Child3", parent.transform);

        // Lấy GameObject cha
        Transform parentTransform = transform.parent;

        // Lấy tất cả GameObject con
        Transform[] children = GetComponentsInChildren<Transform>();

        // Đếm số con
        int childCount = transform.childCount;
        Debug.Log($"Số con: {childCount}");

        // Xóa tất cả con
        foreach (Transform child in transform)
        {
            Destroy(child.gameObject);
        }
    }
}
```

### Tổ chức Scene

```csharp
public class SceneOrganizer : MonoBehaviour
{
    void Start()
    {
        // Tạo các thư mục tổ chức
        GameObject environment = new GameObject("Environment");
        GameObject enemies = new GameObject("Enemies");
        GameObject ui = new GameObject("UI");

        // Di chuyển GameObject vào thư mục
        GameObject.Find("Ground").transform.SetParent(environment.transform);
        GameObject.Find("Walls").transform.SetParent(environment.transform);

        // Tạo empty GameObject để tổ chức
        GameObject spawnPoints = new GameObject("Spawn Points");
        spawnPoints.transform.SetParent(enemies.transform);
    }
}
```

## 🎭 5. Prefab - Template cho GameObject

### Prefab là gì?

Prefab là **template** của GameObject được lưu trong Project. Khi bạn thay đổi Prefab, tất cả instance của nó sẽ thay đổi theo.

### Tại sao cần Prefab?

✅ **Ưu điểm**:

- **Consistency**: Tất cả instances giống nhau
- **Easy Updates**: Sửa 1 lần, áp dụng cho tất cả
- **Memory Efficient**: Chia sẻ assets
- **Version Control**: Dễ track changes

### Tạo và sử dụng Prefab

```csharp
public class PrefabExample : MonoBehaviour
{
    public GameObject enemyPrefab; // Kéo Prefab vào đây trong Inspector

    void Start()
    {
        // Tạo instance từ Prefab
        GameObject enemy1 = Instantiate(enemyPrefab);
        enemy1.transform.position = new Vector3(0, 0, 0);

        // Tạo với vị trí và xoay cụ thể
        GameObject enemy2 = Instantiate(enemyPrefab, new Vector3(5, 0, 0), Quaternion.identity);

        // Tạo với parent
        GameObject enemy3 = Instantiate(enemyPrefab, transform);

        // Tạo nhiều instance
        for (int i = 0; i < 5; i++)
        {
            Vector3 spawnPos = new Vector3(i * 2, 0, 0);
            Instantiate(enemyPrefab, spawnPos, Quaternion.identity);
        }
    }
}
```

### Quản lý Prefab Instance

```csharp
public class PrefabManager : MonoBehaviour
{
    public GameObject bulletPrefab;
    public Transform firePoint;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            FireBullet();
        }
    }

    void FireBullet()
    {
        // Tạo bullet từ Prefab
        GameObject bullet = Instantiate(bulletPrefab, firePoint.position, firePoint.rotation);

        // Thêm lực đẩy
        Rigidbody rb = bullet.GetComponent<Rigidbody>();
        if (rb != null)
        {
            rb.AddForce(firePoint.forward * 1000f);
        }

        // Tự động xóa sau 5 giây
        Destroy(bullet, 5f);
    }
}
```

### Prefab Variants

```csharp
public class EnemySpawner : MonoBehaviour
{
    public GameObject[] enemyPrefabs; // Mảng các Prefab khác nhau

    void Start()
    {
        // Spawn enemy ngẫu nhiên
        int randomIndex = Random.Range(0, enemyPrefabs.Length);
        GameObject randomEnemy = enemyPrefabs[randomIndex];

        Instantiate(randomEnemy, transform.position, transform.rotation);
    }
}
```

## 🏷️ 6. Tag và Layer

### Tag - Nhãn phân loại

Tag giúp phân loại GameObject để dễ tìm và quản lý:

```csharp
public class TagExample : MonoBehaviour
{
    void Start()
    {
        // Kiểm tra tag
        if (gameObject.CompareTag("Player"))
        {
            Debug.Log("Đây là Player!");
        }

        // Tìm GameObject theo tag
        GameObject player = GameObject.FindWithTag("Player");
        GameObject[] enemies = GameObject.FindGameObjectsWithTag("Enemy");

        // Đặt tag cho GameObject
        gameObject.tag = "Enemy";
    }

    void OnTriggerEnter(Collider other)
    {
        // Kiểm tra tag khi va chạm
        if (other.CompareTag("Player"))
        {
            Debug.Log("Player đã vào vùng!");
        }
        else if (other.CompareTag("Enemy"))
        {
            Debug.Log("Enemy đã vào vùng!");
        }
    }
}
```

### Layer - Lớp phân loại

Layer giúp phân loại GameObject cho Physics và Rendering:

```csharp
public class LayerExample : MonoBehaviour
{
    void Start()
    {
        // Đặt layer cho GameObject
        gameObject.layer = LayerMask.NameToLayer("Enemy");

        // Kiểm tra layer
        if (gameObject.layer == LayerMask.NameToLayer("Player"))
        {
            Debug.Log("Đây là Player layer!");
        }

        // Sử dụng LayerMask cho Physics
        LayerMask enemyLayer = 1 << LayerMask.NameToLayer("Enemy");

        // Raycast chỉ với Enemy layer
        RaycastHit hit;
        if (Physics.Raycast(transform.position, transform.forward, out hit, 10f, enemyLayer))
        {
            Debug.Log($"Hit enemy: {hit.collider.name}");
        }
    }
}
```

### Tag và Layer trong thực tế

```csharp
public class CombatSystem : MonoBehaviour
{
    public LayerMask enemyLayerMask;

    void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            Attack();
        }
    }

    void Attack()
    {
        // Tìm tất cả enemy trong bán kính
        Collider[] enemies = Physics.OverlapSphere(transform.position, 5f, enemyLayerMask);

        foreach (Collider enemy in enemies)
        {
            // Kiểm tra tag để chắc chắn
            if (enemy.CompareTag("Enemy"))
            {
                // Gây sát thương
                EnemyHealth enemyHealth = enemy.GetComponent<EnemyHealth>();
                if (enemyHealth != null)
                {
                    enemyHealth.TakeDamage(25);
                }
            }
        }
    }
}
```

## 👑 7. Singleton Pattern - Chỉ có một instance

### Singleton là gì?

**Singleton Pattern** đảm bảo một class chỉ có **một instance duy nhất** trong toàn bộ application.

### Tại sao cần Singleton trong Unity?

✅ **Dùng khi**:

- **GameManager** - Quản lý game state
- **AudioManager** - Quản lý âm thanh
- **InputManager** - Quản lý input
- **UIManager** - Quản lý UI

❌ **Không dùng khi**:

- Cần nhiều instances
- Cần testability cao
- Cần flexibility

### Singleton cơ bản

```csharp
public class GameManager : MonoBehaviour
{
    // Static instance - chỉ có 1 GameManager
    public static GameManager Instance { get; private set; }

    // Game data
    public int score = 0;
    public int lives = 3;
    public bool isGamePaused = false;

    void Awake()
    {
        // Singleton pattern
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject); // Không bị xóa khi load scene mới
        }
        else
        {
            Destroy(gameObject); // Xóa duplicate
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

// Sử dụng Singleton từ bất kỳ đâu
public class Enemy : MonoBehaviour
{
    void OnDestroy()
    {
        // Truy cập Singleton
        GameManager.Instance.AddScore(100);
    }
}

public class Player : MonoBehaviour
{
    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            if (GameManager.Instance.isGamePaused)
            {
                GameManager.Instance.ResumeGame();
            }
            else
            {
                GameManager.Instance.PauseGame();
            }
        }
    }
}
```

### Singleton với Events

```csharp
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    [Header("Audio Sources")]
    public AudioSource musicSource;
    public AudioSource sfxSource;

    [Header("Volume")]
    public float masterVolume = 1f;
    public float musicVolume = 0.7f;
    public float sfxVolume = 0.8f;

    // Events
    public event Action<float> OnVolumeChanged;

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

    public void PlayMusic(AudioClip clip)
    {
        musicSource.clip = clip;
        musicSource.loop = true;
        musicSource.Play();
    }

    public void PlaySFX(AudioClip clip)
    {
        sfxSource.PlayOneShot(clip);
    }

    public void SetMasterVolume(float volume)
    {
        masterVolume = volume;
        UpdateVolumes();
        OnVolumeChanged?.Invoke(volume);
    }

    void UpdateVolumes()
    {
        musicSource.volume = musicVolume * masterVolume;
        sfxSource.volume = sfxVolume * masterVolume;
    }
}
```

### DontDestroyOnLoad chi tiết

```csharp
public class PersistentData : MonoBehaviour
{
    public static PersistentData Instance { get; private set; }

    // Data cần persist qua scenes
    public int playerLevel = 1;
    public int totalScore = 0;
    public string playerName = "Player";

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;

            // Quan trọng: DontDestroyOnLoad phải gọi trong Awake
            DontDestroyOnLoad(gameObject);

            // Load data từ PlayerPrefs
            LoadData();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void LoadData()
    {
        playerLevel = PlayerPrefs.GetInt("PlayerLevel", 1);
        totalScore = PlayerPrefs.GetInt("TotalScore", 0);
        playerName = PlayerPrefs.GetString("PlayerName", "Player");
    }

    public void SaveData()
    {
        PlayerPrefs.SetInt("PlayerLevel", playerLevel);
        PlayerPrefs.SetInt("TotalScore", totalScore);
        PlayerPrefs.SetString("PlayerName", playerName);
        PlayerPrefs.Save();
    }

    void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus)
        {
            SaveData(); // Save khi pause
        }
    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (!hasFocus)
        {
            SaveData(); // Save khi mất focus
        }
    }
}
```

## 🏊‍♂️ 8. Object Pooling - Tối ưu Performance

### Object Pooling là gì?

**Object Pooling** = Tạo trước một số objects và **tái sử dụng** thay vì tạo/xóa liên tục.

### Tại sao cần Object Pooling?

❌ **Không dùng Pooling**:

```csharp
// Mỗi lần bắn đạn
void FireBullet()
{
    GameObject bullet = Instantiate(bulletPrefab); // Tạo mới
    // ... logic
    Destroy(bullet, 5f); // Xóa sau 5 giây
}
// Vấn đề: Instantiate/Destroy rất tốn performance!
```

✅ **Dùng Pooling**:

```csharp
// Tạo trước bullets, tái sử dụng
void FireBullet()
{
    GameObject bullet = bulletPool.Get(); // Lấy từ pool
    // ... logic
    bulletPool.Return(bullet, 5f); // Trả về pool sau 5 giây
}
// Kết quả: Performance tốt hơn nhiều!
```

### Object Pool cơ bản

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

    public void Return(T obj, float delay)
    {
        // Trả về pool sau delay
        MonoBehaviour.StartCoroutine(ReturnAfterDelay(obj, delay));
    }

    private IEnumerator ReturnAfterDelay(T obj, float delay)
    {
        yield return new WaitForSeconds(delay);
        Return(obj);
    }
}
```

### Bullet Pool System

```csharp
public class BulletPool : MonoBehaviour
{
    public Bullet bulletPrefab;
    public int poolSize = 50;

    private ObjectPool<Bullet> bulletPool;

    void Start()
    {
        // Tạo bullet pool
        bulletPool = new ObjectPool<Bullet>(bulletPrefab, poolSize, transform);
    }

    public void FireBullet(Vector3 position, Vector3 direction)
    {
        // Lấy bullet từ pool
        Bullet bullet = bulletPool.Get();

        // Setup bullet
        bullet.transform.position = position;
        bullet.transform.rotation = Quaternion.LookRotation(direction);
        bullet.SetDirection(direction);

        // Trả về pool sau 5 giây
        bulletPool.Return(bullet, 5f);
    }
}

public class Bullet : MonoBehaviour
{
    private Rigidbody rb;
    private float speed = 20f;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
    }

    public void SetDirection(Vector3 direction)
    {
        rb.velocity = direction * speed;
    }

    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Enemy"))
        {
            // Hit enemy logic
            other.GetComponent<EnemyHealth>()?.TakeDamage(25);
        }

        // Bullet sẽ được trả về pool tự động
    }
}
```

### Enemy Pool System

```csharp
public class EnemySpawner : MonoBehaviour
{
    public Enemy enemyPrefab;
    public int maxEnemies = 20;
    public float spawnInterval = 2f;

    private ObjectPool<Enemy> enemyPool;
    private List<Enemy> activeEnemies = new List<Enemy>();

    void Start()
    {
        enemyPool = new ObjectPool<Enemy>(enemyPrefab, maxEnemies, transform);
        StartCoroutine(SpawnEnemies());
    }

    IEnumerator SpawnEnemies()
    {
        while (true)
        {
            if (activeEnemies.Count < maxEnemies)
            {
                SpawnEnemy();
            }

            yield return new WaitForSeconds(spawnInterval);
        }
    }

    void SpawnEnemy()
    {
        // Lấy enemy từ pool
        Enemy enemy = enemyPool.Get();

        // Setup enemy
        Vector3 spawnPos = GetRandomSpawnPosition();
        enemy.transform.position = spawnPos;
        enemy.OnDeath += () => ReturnEnemyToPool(enemy);

        activeEnemies.Add(enemy);
    }

    void ReturnEnemyToPool(Enemy enemy)
    {
        activeEnemies.Remove(enemy);
        enemyPool.Return(enemy);
    }

    Vector3 GetRandomSpawnPosition()
    {
        float x = Random.Range(-10f, 10f);
        float z = Random.Range(-10f, 10f);
        return new Vector3(x, 0, z);
    }
}
```

### Generic Pool Manager

```csharp
public class PoolManager : MonoBehaviour
{
    public static PoolManager Instance { get; private set; }

    [System.Serializable]
    public class Pool
    {
        public string name;
        public GameObject prefab;
        public int size;
    }

    public Pool[] pools;
    private Dictionary<string, ObjectPool<GameObject>> poolDictionary;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
            InitializePools();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void InitializePools()
    {
        poolDictionary = new Dictionary<string, ObjectPool<GameObject>>();

        foreach (Pool pool in pools)
        {
            ObjectPool<GameObject> objectPool = new ObjectPool<GameObject>(
                pool.prefab,
                pool.size,
                transform
            );
            poolDictionary.Add(pool.name, objectPool);
        }
    }

    public GameObject SpawnFromPool(string poolName, Vector3 position, Quaternion rotation)
    {
        if (!poolDictionary.ContainsKey(poolName))
        {
            Debug.LogWarning($"Pool {poolName} doesn't exist!");
            return null;
        }

        GameObject obj = poolDictionary[poolName].Get();
        obj.transform.position = position;
        obj.transform.rotation = rotation;

        return obj;
    }

    public void ReturnToPool(string poolName, GameObject obj)
    {
        if (poolDictionary.ContainsKey(poolName))
        {
            poolDictionary[poolName].Return(obj);
        }
    }
}

// Sử dụng PoolManager
public class Weapon : MonoBehaviour
{
    public Transform firePoint;

    void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            GameObject bullet = PoolManager.Instance.SpawnFromPool(
                "Bullet",
                firePoint.position,
                firePoint.rotation
            );

            // Setup bullet
            bullet.GetComponent<Rigidbody>().AddForce(firePoint.forward * 1000f);

            // Return to pool after 5 seconds
            StartCoroutine(ReturnBulletAfterDelay(bullet, 5f));
        }
    }

    IEnumerator ReturnBulletAfterDelay(GameObject bullet, float delay)
    {
        yield return new WaitForSeconds(delay);
        PoolManager.Instance.ReturnToPool("Bullet", bullet);
    }
}
```

## 📄 9. ScriptableObject - Data Management

### ScriptableObject là gì?

**ScriptableObject** là class đặc biệt của Unity để lưu trữ **data** mà không cần GameObject.

### Tại sao cần ScriptableObject?

✅ **Ưu điểm**:

- **Performance**: Không tốn memory như GameObject
- **Reusability**: Một ScriptableObject có thể dùng cho nhiều objects
- **Version Control**: Dễ track changes
- **Inspector**: Có thể edit trong Inspector
- **Hot Reload**: Thay đổi data mà không cần restart

❌ **Nhược điểm**:

- Không thể có MonoBehaviour methods
- Không thể có references đến Scene objects

### ScriptableObject cơ bản

```csharp
[CreateAssetMenu(fileName = "New Weapon", menuName = "Game/Weapon")]
public class WeaponData : ScriptableObject
{
    [Header("Basic Info")]
    public string weaponName;
    public string description;
    public Sprite icon;

    [Header("Stats")]
    public int damage;
    public float fireRate;
    public float range;
    public int ammoCapacity;

    [Header("Audio")]
    public AudioClip fireSound;
    public AudioClip reloadSound;

    [Header("Effects")]
    public GameObject muzzleFlash;
    public GameObject bulletTrail;
}

// Sử dụng WeaponData
public class Weapon : MonoBehaviour
{
    public WeaponData weaponData;

    void Start()
    {
        if (weaponData != null)
        {
            Debug.Log($"Weapon: {weaponData.weaponName}");
            Debug.Log($"Damage: {weaponData.damage}");
        }
    }

    public void Fire()
    {
        if (weaponData != null)
        {
            // Play fire sound
            AudioSource.PlayClipAtPoint(weaponData.fireSound, transform.position);

            // Create muzzle flash
            if (weaponData.muzzleFlash != null)
            {
                Instantiate(weaponData.muzzleFlash, transform.position, transform.rotation);
            }
        }
    }
}
```

### Character Data System

```csharp
[CreateAssetMenu(fileName = "New Character", menuName = "Game/Character")]
public class CharacterData : ScriptableObject
{
    [Header("Basic Info")]
    public string characterName;
    public Sprite portrait;
    public string description;

    [Header("Stats")]
    public int maxHealth;
    public int maxMana;
    public float moveSpeed;
    public float jumpForce;

    [Header("Abilities")]
    public AbilityData[] abilities;

    [Header("Audio")]
    public AudioClip[] voiceLines;
    public AudioClip[] footstepSounds;
}

[CreateAssetMenu(fileName = "New Ability", menuName = "Game/Ability")]
public class AbilityData : ScriptableObject
{
    public string abilityName;
    public string description;
    public int manaCost;
    public float cooldown;
    public int damage;
    public float range;
    public GameObject effectPrefab;
}

// Character sử dụng CharacterData
public class Character : MonoBehaviour
{
    public CharacterData characterData;

    private int currentHealth;
    private int currentMana;

    void Start()
    {
        if (characterData != null)
        {
            currentHealth = characterData.maxHealth;
            currentMana = characterData.maxMana;

            Debug.Log($"Character: {characterData.characterName}");
            Debug.Log($"Health: {currentHealth}/{characterData.maxHealth}");
        }
    }

    public void UseAbility(int abilityIndex)
    {
        if (characterData != null && abilityIndex < characterData.abilities.Length)
        {
            AbilityData ability = characterData.abilities[abilityIndex];

            if (currentMana >= ability.manaCost)
            {
                currentMana -= ability.manaCost;
                Debug.Log($"Used {ability.abilityName}!");

                // Ability logic here
            }
            else
            {
                Debug.Log("Not enough mana!");
            }
        }
    }
}
```

### Game Settings

```csharp
[CreateAssetMenu(fileName = "Game Settings", menuName = "Game/Settings")]
public class GameSettings : ScriptableObject
{
    [Header("Graphics")]
    public int targetFrameRate = 60;
    public bool vsyncEnabled = true;
    public int qualityLevel = 2;

    [Header("Audio")]
    public float masterVolume = 1f;
    public float musicVolume = 0.7f;
    public float sfxVolume = 0.8f;

    [Header("Gameplay")]
    public float gameSpeed = 1f;
    public bool autoSave = true;
    public int autoSaveInterval = 300; // seconds

    [Header("Input")]
    public float mouseSensitivity = 1f;
    public bool invertY = false;
    public KeyCode jumpKey = KeyCode.Space;
    public KeyCode fireKey = KeyCode.Mouse0;
}

// GameManager sử dụng GameSettings
public class GameManager : MonoBehaviour
{
    public GameSettings gameSettings;

    void Start()
    {
        if (gameSettings != null)
        {
            ApplySettings();
        }
    }

    void ApplySettings()
    {
        // Apply graphics settings
        Application.targetFrameRate = gameSettings.targetFrameRate;
        QualitySettings.vSyncCount = gameSettings.vsyncEnabled ? 1 : 0;
        QualitySettings.SetQualityLevel(gameSettings.qualityLevel);

        // Apply audio settings
        AudioListener.volume = gameSettings.masterVolume;

        // Apply gameplay settings
        Time.timeScale = gameSettings.gameSpeed;

        Debug.Log("Game settings applied!");
    }

    public void UpdateSettings()
    {
        if (gameSettings != null)
        {
            ApplySettings();
        }
    }
}
```

### ScriptableObject Events

```csharp
[CreateAssetMenu(fileName = "Game Event", menuName = "Game/Event")]
public class GameEvent : ScriptableObject
{
    private List<GameEventListener> listeners = new List<GameEventListener>();

    public void RegisterListener(GameEventListener listener)
    {
        if (!listeners.Contains(listener))
        {
            listeners.Add(listener);
        }
    }

    public void UnregisterListener(GameEventListener listener)
    {
        if (listeners.Contains(listener))
        {
            listeners.Remove(listener);
        }
    }

    public void Raise()
    {
        for (int i = listeners.Count - 1; i >= 0; i--)
        {
            listeners[i].OnEventRaised();
        }
    }
}

public class GameEventListener : MonoBehaviour
{
    public GameEvent gameEvent;
    public UnityEvent response;

    void OnEnable()
    {
        if (gameEvent != null)
        {
            gameEvent.RegisterListener(this);
        }
    }

    void OnDisable()
    {
        if (gameEvent != null)
        {
            gameEvent.UnregisterListener(this);
        }
    }

    public void OnEventRaised()
    {
        response.Invoke();
    }
}

// Sử dụng GameEvent
public class Enemy : MonoBehaviour
{
    public GameEvent onEnemyDeath;

    void Die()
    {
        // Raise event
        onEnemyDeath?.Raise();

        // Destroy enemy
        Destroy(gameObject);
    }
}
```

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Game Manager Singleton

Tạo GameManager với:

- Singleton pattern với DontDestroyOnLoad
- Game state management (Menu, Playing, Paused, GameOver)
- Score system với persistence
- Settings system với ScriptableObject
- Event system cho game states

### Bài tập 2: Object Pooling System

Tạo hệ thống pooling cho:

- Bullets với different types
- Enemy spawning với different types
- Particle effects
- UI elements (damage numbers, notifications)
- Performance comparison vs Instantiate/Destroy

### Bài tập 3: Data-driven Character System

Tạo character system với:

- CharacterData ScriptableObject
- AbilityData ScriptableObject
- EquipmentData ScriptableObject
- Character customization system
- Save/Load character data

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu Component Pattern và tại sao Unity dùng nó
- [ ] Thành thạo GameObject và Component management
- [ ] Hiểu Transform và các operations
- [ ] Tổ chức Scene và Hierarchy hiệu quả
- [ ] Sử dụng Prefab với best practices
- [ ] Sử dụng Tag và Layer chuyên nghiệp
- [ ] Implement Singleton Pattern đúng cách
- [ ] Sử dụng DontDestroyOnLoad cho persistent data
- [ ] Implement Object Pooling để tối ưu performance
- [ ] Sử dụng ScriptableObject cho data management
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã nắm vững Unity Fundamentals cơ bản VÀ nâng cao! Giờ bạn có thể:

- Tạo systems scalable và maintainable
- Tối ưu performance với Object Pooling
- Quản lý data hiệu quả với ScriptableObject
- Implement design patterns trong Unity

**Bài tiếp theo**: [Physics System - Rigidbody, Collider, Raycast](./03-physics-system.md)

---

💡 **Tips nâng cao**:

- **Component Pattern** giúp code modular và reusable
- **Singleton** chỉ dùng khi thực sự cần, tránh overuse
- **Object Pooling** là must-have cho performance
- **ScriptableObject** perfect cho data-driven design
- **DontDestroyOnLoad** phải gọi trong Awake, không phải Start
