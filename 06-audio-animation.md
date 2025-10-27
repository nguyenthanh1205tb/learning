# 🎵 Bài 6: Audio & Animation - Cơ bản và Nâng cao

## 🎯 Mục tiêu bài học

- Hiểu Audio Source và Audio Clip với best practices
- Phân biệt PlayOneShot vs Play và khi nào dùng
- Thành thạo Animator Controller và State Machine
- Tạo Animation Clips với Animation Curves
- Sử dụng Animation Parameters và Blend Trees
- Trigger animations từ code với Animation Events
- Thành thạo Animation Layers và Blend Modes
- Hiểu IK (Inverse Kinematics) cơ bản
- Sử dụng Audio Mixing và Audio Groups
- Tạo procedural animations với Animation Curves

## 🎵 1. Audio System chi tiết

### Audio Source - Nguồn phát âm thanh

```csharp
public class AudioExample : MonoBehaviour
{
    public AudioSource audioSource;
    public AudioClip jumpSound;
    public AudioClip attackSound;
    public AudioClip backgroundMusic;

    void Start()
    {
        // Lấy AudioSource component
        audioSource = GetComponent<AudioSource>();

        // Cấu hình AudioSource
        audioSource.volume = 0.5f;
        audioSource.pitch = 1f;
        audioSource.loop = false;
        audioSource.playOnAwake = false;

        // Phát nhạc nền
        PlayBackgroundMusic();
    }

    void PlayBackgroundMusic()
    {
        if (backgroundMusic != null)
        {
            audioSource.clip = backgroundMusic;
            audioSource.loop = true;
            audioSource.volume = 0.3f;
            audioSource.Play();
        }
    }

    void Update()
    {
        // Phát âm thanh khi nhấn phím
        if (Input.GetKeyDown(KeyCode.Space))
        {
            PlayJumpSound();
        }

        if (Input.GetMouseButtonDown(0))
        {
            PlayAttackSound();
        }
    }

    void PlayJumpSound()
    {
        if (jumpSound != null)
        {
            audioSource.PlayOneShot(jumpSound);
        }
    }

    void PlayAttackSound()
    {
        if (attackSound != null)
        {
            audioSource.PlayOneShot(attackSound, 0.8f); // Volume 0.8
        }
    }
}
```

### PlayOneShot vs Play chi tiết

```csharp
public class AudioPlayback : MonoBehaviour
{
    public AudioSource audioSource;
    public AudioClip[] soundEffects;

    void Start()
    {
        audioSource = GetComponent<AudioSource>();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            // PlayOneShot - Phát âm thanh mà không dừng âm thanh hiện tại
            // ✅ Dùng cho: Sound effects, multiple sounds cùng lúc
            audioSource.PlayOneShot(soundEffects[0]);
        }

        if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            // Play - Dừng âm thanh hiện tại và phát âm thanh mới
            // ✅ Dùng cho: Music, single sound at a time
            audioSource.clip = soundEffects[1];
            audioSource.Play();
        }

        if (Input.GetKeyDown(KeyCode.Alpha3))
        {
            // PlayOneShot với volume khác nhau
            audioSource.PlayOneShot(soundEffects[2], 0.5f);
        }
    }
}
```

### Audio Manager nâng cao

```csharp
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance;

    [Header("Audio Sources")]
    public AudioSource musicSource;
    public AudioSource sfxSource;
    public AudioSource ambientSource;

    [Header("Music")]
    public AudioClip mainMenuMusic;
    public AudioClip gameMusic;
    public AudioClip gameOverMusic;

    [Header("Sound Effects")]
    public AudioClip jumpSound;
    public AudioClip attackSound;
    public AudioClip collectSound;
    public AudioClip damageSound;

    [Header("Volume Settings")]
    public float masterVolume = 1f;
    public float musicVolume = 0.7f;
    public float sfxVolume = 0.8f;
    public float ambientVolume = 0.5f;

    // Audio mixing
    private Coroutine musicFadeCoroutine;
    private Coroutine sfxDuckCoroutine;

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

    void Start()
    {
        // Load volume settings từ PlayerPrefs
        masterVolume = PlayerPrefs.GetFloat("MasterVolume", 1f);
        musicVolume = PlayerPrefs.GetFloat("MusicVolume", 0.7f);
        sfxVolume = PlayerPrefs.GetFloat("SFXVolume", 0.8f);
        ambientVolume = PlayerPrefs.GetFloat("AmbientVolume", 0.5f);

        UpdateVolumes();
    }

    public void PlayMusic(AudioClip clip, bool fadeIn = true)
    {
        if (musicSource.clip != clip)
        {
            if (fadeIn && musicSource.isPlaying)
            {
                StartCoroutine(FadeOutAndPlayMusic(clip));
            }
            else
            {
                musicSource.clip = clip;
                musicSource.loop = true;
                musicSource.Play();
            }
        }
    }

    public void PlaySFX(AudioClip clip)
    {
        sfxSource.PlayOneShot(clip);

        // Duck music when SFX plays
        StartCoroutine(DuckMusic());
    }

    public void PlaySFX(AudioClip clip, float volume)
    {
        sfxSource.PlayOneShot(clip, volume);
        StartCoroutine(DuckMusic());
    }

    public void PlayAmbient(AudioClip clip)
    {
        ambientSource.clip = clip;
        ambientSource.loop = true;
        ambientSource.Play();
    }

    public void SetMasterVolume(float volume)
    {
        masterVolume = volume;
        UpdateVolumes();
        PlayerPrefs.SetFloat("MasterVolume", volume);
    }

    public void SetMusicVolume(float volume)
    {
        musicVolume = volume;
        UpdateVolumes();
        PlayerPrefs.SetFloat("MusicVolume", volume);
    }

    public void SetSFXVolume(float volume)
    {
        sfxVolume = volume;
        UpdateVolumes();
        PlayerPrefs.SetFloat("SFXVolume", volume);
    }

    public void SetAmbientVolume(float volume)
    {
        ambientVolume = volume;
        UpdateVolumes();
        PlayerPrefs.SetFloat("AmbientVolume", volume);
    }

    void UpdateVolumes()
    {
        musicSource.volume = musicVolume * masterVolume;
        sfxSource.volume = sfxVolume * masterVolume;
        ambientSource.volume = ambientVolume * masterVolume;
    }

    IEnumerator FadeOutAndPlayMusic(AudioClip newClip)
    {
        // Fade out current music
        float startVolume = musicSource.volume;
        while (musicSource.volume > 0)
        {
            musicSource.volume -= startVolume * Time.deltaTime / 1f; // 1 second fade
            yield return null;
        }

        // Change clip and fade in
        musicSource.clip = newClip;
        musicSource.loop = true;
        musicSource.Play();

        while (musicSource.volume < musicVolume * masterVolume)
        {
            musicSource.volume += startVolume * Time.deltaTime / 1f;
            yield return null;
        }

        musicSource.volume = musicVolume * masterVolume;
    }

    IEnumerator DuckMusic()
    {
        float originalVolume = musicSource.volume;
        musicSource.volume = originalVolume * 0.3f; // Duck to 30%

        yield return new WaitForSeconds(0.5f);

        musicSource.volume = originalVolume;
    }

    public void StopMusic()
    {
        musicSource.Stop();
    }

    public void PauseMusic()
    {
        musicSource.Pause();
    }

    public void ResumeMusic()
    {
        musicSource.UnPause();
    }
}
```

### 3D Audio chi tiết

```csharp
public class Audio3D : MonoBehaviour
{
    public AudioSource audioSource;
    public AudioClip footstepSound;
    public AudioClip ambientSound;

    void Start()
    {
        audioSource = GetComponent<AudioSource>();

        // Cấu hình cho 3D audio
        audioSource.spatialBlend = 1f; // 0 = 2D, 1 = 3D
        audioSource.rolloffMode = AudioRolloffMode.Logarithmic;
        audioSource.minDistance = 1f;
        audioSource.maxDistance = 20f;

        // Doppler effect
        audioSource.dopplerLevel = 1f;

        // Reverb zones
        audioSource.reverbZoneMix = 1f;

        // Phát âm thanh ambient
        audioSource.clip = ambientSound;
        audioSource.loop = true;
        audioSource.Play();
    }

    void Update()
    {
        // Phát âm thanh bước chân khi di chuyển
        if (Input.GetAxis("Horizontal") != 0 || Input.GetAxis("Vertical") != 0)
        {
            if (!audioSource.isPlaying)
            {
                audioSource.PlayOneShot(footstepSound);
            }
        }
    }
}
```

## 🎭 2. Animation System chi tiết

### Animator Controller

```csharp
public class AnimationController : MonoBehaviour
{
    private Animator animator;

    // Animation parameters
    private int speedHash;
    private int jumpHash;
    private int attackHash;
    private int isGroundedHash;

    void Start()
    {
        animator = GetComponent<Animator>();

        // Cache parameter hashes để tăng performance
        speedHash = Animator.StringToHash("Speed");
        jumpHash = Animator.StringToHash("Jump");
        attackHash = Animator.StringToHash("Attack");
        isGroundedHash = Animator.StringToHash("IsGrounded");
    }

    void Update()
    {
        // Cập nhật animation parameters
        float speed = Input.GetAxis("Horizontal");
        animator.SetFloat(speedHash, Mathf.Abs(speed));

        // Kiểm tra ground
        bool isGrounded = CheckGrounded();
        animator.SetBool(isGroundedHash, isGrounded);

        // Trigger animations
        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            animator.SetTrigger(jumpHash);
        }

        if (Input.GetMouseButtonDown(0))
        {
            animator.SetTrigger(attackHash);
        }
    }

    bool CheckGrounded()
    {
        // Raycast để kiểm tra ground
        return Physics.Raycast(transform.position, Vector3.down, 0.1f);
    }
}
```

### Animation Events

```csharp
public class AnimationEvents : MonoBehaviour
{
    public AudioSource audioSource;
    public AudioClip footstepSound;
    public AudioClip attackSound;

    // Animation Event - Gọi từ Animation Clip
    public void OnFootstep()
    {
        if (footstepSound != null)
        {
            audioSource.PlayOneShot(footstepSound);
        }
    }

    public void OnAttackHit()
    {
        if (attackSound != null)
        {
            audioSource.PlayOneShot(attackSound);
        }

        // Logic tấn công
        AttackEnemies();
    }

    public void OnJumpStart()
    {
        Debug.Log("Jump animation started");
    }

    public void OnJumpEnd()
    {
        Debug.Log("Jump animation ended");
    }

    void AttackEnemies()
    {
        // Logic tấn công enemy
        Collider[] enemies = Physics.OverlapSphere(transform.position, 2f);
        foreach (Collider enemy in enemies)
        {
            if (enemy.CompareTag("Enemy"))
            {
                // Gây sát thương
                Debug.Log($"Attacked {enemy.name}");
            }
        }
    }
}
```

### State Machine chi tiết

```csharp
public class PlayerStateMachine : MonoBehaviour
{
    private Animator animator;

    // State hashes
    private int idleStateHash;
    private int walkStateHash;
    private int runStateHash;
    private int jumpStateHash;
    private int attackStateHash;

    void Start()
    {
        animator = GetComponent<Animator>();

        // Cache state hashes
        idleStateHash = Animator.StringToHash("Base Layer.Idle");
        walkStateHash = Animator.StringToHash("Base Layer.Walk");
        runStateHash = Animator.StringToHash("Base Layer.Run");
        jumpStateHash = Animator.StringToHash("Base Layer.Jump");
        attackStateHash = Animator.StringToHash("Base Layer.Attack");
    }

    void Update()
    {
        // Kiểm tra state hiện tại
        AnimatorStateInfo stateInfo = animator.GetCurrentAnimatorStateInfo(0);

        if (stateInfo.shortNameHash == idleStateHash)
        {
            Debug.Log("Player is idle");
        }
        else if (stateInfo.shortNameHash == walkStateHash)
        {
            Debug.Log("Player is walking");
        }
        else if (stateInfo.shortNameHash == runStateHash)
        {
            Debug.Log("Player is running");
        }
        else if (stateInfo.shortNameHash == jumpStateHash)
        {
            Debug.Log("Player is jumping");
        }
        else if (stateInfo.shortNameHash == attackStateHash)
        {
            Debug.Log("Player is attacking");
        }

        // Kiểm tra animation có đang chạy không
        if (stateInfo.IsName("Attack") && stateInfo.normalizedTime >= 1f)
        {
            Debug.Log("Attack animation finished");
        }
    }
}
```

### Blend Trees chi tiết

```csharp
public class BlendTreeController : MonoBehaviour
{
    private Animator animator;

    // Blend tree parameters
    private int speedHash;
    private int directionHash;

    void Start()
    {
        animator = GetComponent<Animator>();

        speedHash = Animator.StringToHash("Speed");
        directionHash = Animator.StringToHash("Direction");
    }

    void Update()
    {
        // Input từ keyboard
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        // Tính toán speed và direction
        float speed = Mathf.Sqrt(horizontal * horizontal + vertical * vertical);
        float direction = Mathf.Atan2(horizontal, vertical) * Mathf.Rad2Deg;

        // Cập nhật blend tree parameters
        animator.SetFloat(speedHash, speed);
        animator.SetFloat(directionHash, direction);

        // Xoay character theo hướng di chuyển
        if (speed > 0.1f)
        {
            transform.rotation = Quaternion.Euler(0, direction, 0);
        }
    }
}
```

### Animation Layers chi tiết

```csharp
public class AnimationLayers : MonoBehaviour
{
    private Animator animator;

    // Layer indices
    private int baseLayerIndex = 0;
    private int upperBodyLayerIndex = 1;
    private int faceLayerIndex = 2;

    void Start()
    {
        animator = GetComponent<Animator>();

        // Set layer weights
        animator.SetLayerWeight(baseLayerIndex, 1f);
        animator.SetLayerWeight(upperBodyLayerIndex, 1f);
        animator.SetLayerWeight(faceLayerIndex, 0.5f);
    }

    void Update()
    {
        // Base layer - Movement
        float speed = Input.GetAxis("Horizontal");
        animator.SetFloat("Speed", Mathf.Abs(speed));

        // Upper body layer - Combat
        if (Input.GetMouseButton(1)) // Right click
        {
            animator.SetLayerWeight(upperBodyLayerIndex, 1f);
            animator.SetBool("IsAiming", true);
        }
        else
        {
            animator.SetLayerWeight(upperBodyLayerIndex, 0f);
            animator.SetBool("IsAiming", false);
        }

        // Face layer - Expressions
        if (Input.GetKey(KeyCode.E))
        {
            animator.SetLayerWeight(faceLayerIndex, 1f);
            animator.SetTrigger("Smile");
        }
        else
        {
            animator.SetLayerWeight(faceLayerIndex, 0f);
        }
    }
}
```

## 📈 3. Animation Curves

### Animation Curves là gì?

**Animation Curves** cho phép bạn tạo **custom animation curves** trong code để control animations một cách mượt mà.

### Animation Curves cơ bản

```csharp
public class AnimationCurves : MonoBehaviour
{
    public AnimationCurve scaleCurve;
    public AnimationCurve rotationCurve;
    public AnimationCurve positionCurve;

    void Start()
    {
        // Tạo animation curves
        scaleCurve = new AnimationCurve();
        scaleCurve.AddKey(0f, 1f); // Start at scale 1
        scaleCurve.AddKey(0.5f, 2f); // Peak at scale 2
        scaleCurve.AddKey(1f, 1f); // End at scale 1

        rotationCurve = new AnimationCurve();
        rotationCurve.AddKey(0f, 0f); // Start at 0 degrees
        rotationCurve.AddKey(1f, 360f); // End at 360 degrees

        positionCurve = new AnimationCurve();
        positionCurve.AddKey(0f, 0f); // Start at position 0
        positionCurve.AddKey(0.5f, 5f); // Peak at position 5
        positionCurve.AddKey(1f, 0f); // End at position 0

        // Smooth curves
        for (int i = 0; i < scaleCurve.length; i++)
        {
            scaleCurve.SmoothTangents(i, 0f);
        }
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            StartCoroutine(AnimateWithCurves());
        }
    }

    IEnumerator AnimateWithCurves()
    {
        float duration = 2f;
        float elapsedTime = 0f;

        Vector3 originalScale = transform.localScale;
        Vector3 originalPosition = transform.position;
        Quaternion originalRotation = transform.rotation;

        while (elapsedTime < duration)
        {
            float t = elapsedTime / duration;

            // Apply curves
            float scaleValue = scaleCurve.Evaluate(t);
            float rotationValue = rotationCurve.Evaluate(t);
            float positionValue = positionCurve.Evaluate(t);

            transform.localScale = originalScale * scaleValue;
            transform.rotation = originalRotation * Quaternion.Euler(0, rotationValue, 0);
            transform.position = originalPosition + Vector3.up * positionValue;

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        // Reset to original values
        transform.localScale = originalScale;
        transform.position = originalPosition;
        transform.rotation = originalRotation;
    }
}
```

### Advanced Animation Curves

```csharp
public class AdvancedAnimationCurves : MonoBehaviour
{
    public AnimationCurve bounceCurve;
    public AnimationCurve easeInOutCurve;
    public AnimationCurve elasticCurve;

    void Start()
    {
        // Bounce curve
        bounceCurve = new AnimationCurve();
        bounceCurve.AddKey(0f, 0f);
        bounceCurve.AddKey(0.3f, 1.2f);
        bounceCurve.AddKey(0.6f, 0.8f);
        bounceCurve.AddKey(0.8f, 1.1f);
        bounceCurve.AddKey(1f, 1f);

        // Ease in-out curve
        easeInOutCurve = new AnimationCurve();
        easeInOutCurve.AddKey(0f, 0f);
        easeInOutCurve.AddKey(0.25f, 0.1f);
        easeInOutCurve.AddKey(0.75f, 0.9f);
        easeInOutCurve.AddKey(1f, 1f);

        // Elastic curve
        elasticCurve = new AnimationCurve();
        elasticCurve.AddKey(0f, 0f);
        elasticCurve.AddKey(0.2f, 1.3f);
        elasticCurve.AddKey(0.4f, 0.7f);
        elasticCurve.AddKey(0.6f, 1.1f);
        elasticCurve.AddKey(0.8f, 0.9f);
        elasticCurve.AddKey(1f, 1f);

        // Set tangents for smooth curves
        SetSmoothTangents(bounceCurve);
        SetSmoothTangents(easeInOutCurve);
        SetSmoothTangents(elasticCurve);
    }

    void SetSmoothTangents(AnimationCurve curve)
    {
        for (int i = 0; i < curve.length; i++)
        {
            curve.SmoothTangents(i, 0f);
        }
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.B))
        {
            StartCoroutine(BounceAnimation());
        }

        if (Input.GetKeyDown(KeyCode.E))
        {
            StartCoroutine(EaseInOutAnimation());
        }

        if (Input.GetKeyDown(KeyCode.L))
        {
            StartCoroutine(ElasticAnimation());
        }
    }

    IEnumerator BounceAnimation()
    {
        float duration = 1f;
        float elapsedTime = 0f;
        Vector3 originalScale = transform.localScale;

        while (elapsedTime < duration)
        {
            float t = elapsedTime / duration;
            float scaleValue = bounceCurve.Evaluate(t);
            transform.localScale = originalScale * scaleValue;

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.localScale = originalScale;
    }

    IEnumerator EaseInOutAnimation()
    {
        float duration = 2f;
        float elapsedTime = 0f;
        Vector3 startPos = transform.position;
        Vector3 endPos = startPos + Vector3.right * 5f;

        while (elapsedTime < duration)
        {
            float t = elapsedTime / duration;
            float easeValue = easeInOutCurve.Evaluate(t);
            transform.position = Vector3.Lerp(startPos, endPos, easeValue);

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.position = endPos;
    }

    IEnumerator ElasticAnimation()
    {
        float duration = 1.5f;
        float elapsedTime = 0f;
        Vector3 originalScale = transform.localScale;

        while (elapsedTime < duration)
        {
            float t = elapsedTime / duration;
            float scaleValue = elasticCurve.Evaluate(t);
            transform.localScale = originalScale * scaleValue;

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.localScale = originalScale;
    }
}
```

## 🔄 4. Blend Modes

### Blend Modes là gì?

**Blend Modes** định nghĩa cách **animation layers** được blend với nhau.

### Blend Modes chi tiết

```csharp
public class BlendModes : MonoBehaviour
{
    private Animator animator;

    // Layer indices
    private int baseLayerIndex = 0;
    private int upperBodyLayerIndex = 1;
    private int faceLayerIndex = 2;

    void Start()
    {
        animator = GetComponent<Animator>();

        // Set blend modes
        animator.SetLayerWeight(baseLayerIndex, 1f);
        animator.SetLayerWeight(upperBodyLayerIndex, 1f);
        animator.SetLayerWeight(faceLayerIndex, 0.5f);
    }

    void Update()
    {
        // Base layer - Movement
        float speed = Input.GetAxis("Horizontal");
        animator.SetFloat("Speed", Mathf.Abs(speed));

        // Upper body layer - Combat with additive blending
        if (Input.GetMouseButton(1))
        {
            animator.SetLayerWeight(upperBodyLayerIndex, 1f);
            animator.SetBool("IsAiming", true);
        }
        else
        {
            animator.SetLayerWeight(upperBodyLayerIndex, 0f);
            animator.SetBool("IsAiming", false);
        }

        // Face layer - Expressions with override blending
        if (Input.GetKey(KeyCode.E))
        {
            animator.SetLayerWeight(faceLayerIndex, 1f);
            animator.SetTrigger("Smile");
        }
        else
        {
            animator.SetLayerWeight(faceLayerIndex, 0f);
        }

        // Blend mode controls
        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            // Override blending - Higher layers override lower layers
            SetBlendMode(AnimatorLayerBlendMode.Override);
        }

        if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            // Additive blending - Layers are added together
            SetBlendMode(AnimatorLayerBlendMode.Additive);
        }
    }

    void SetBlendMode(AnimatorLayerBlendMode blendMode)
    {
        // Note: Blend modes are set in the Animator Controller, not in code
        // This is just for demonstration
        Debug.Log($"Blend mode set to: {blendMode}");
    }
}
```

## 🤖 5. IK (Inverse Kinematics) cơ bản

### IK là gì?

**IK (Inverse Kinematics)** cho phép bạn control **end effectors** (như tay, chân) và tự động tính toán joint positions.

### IK Setup

```csharp
public class IKController : MonoBehaviour
{
    private Animator animator;

    [Header("IK Targets")]
    public Transform leftHandTarget;
    public Transform rightHandTarget;
    public Transform leftFootTarget;
    public Transform rightFootTarget;

    [Header("IK Weights")]
    public float leftHandWeight = 1f;
    public float rightHandWeight = 1f;
    public float leftFootWeight = 1f;
    public float rightFootWeight = 1f;

    [Header("IK Settings")]
    public bool enableIK = true;
    public float lookAtWeight = 1f;
    public Transform lookAtTarget;

    void Start()
    {
        animator = GetComponent<Animator>();
    }

    void OnAnimatorIK(int layerIndex)
    {
        if (!enableIK) return;

        // Left Hand IK
        if (leftHandTarget != null)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.LeftHand, leftHandWeight);
            animator.SetIKRotationWeight(AvatarIKGoal.LeftHand, leftHandWeight);
            animator.SetIKPosition(AvatarIKGoal.LeftHand, leftHandTarget.position);
            animator.SetIKRotation(AvatarIKGoal.LeftHand, leftHandTarget.rotation);
        }

        // Right Hand IK
        if (rightHandTarget != null)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.RightHand, rightHandWeight);
            animator.SetIKRotationWeight(AvatarIKGoal.RightHand, rightHandWeight);
            animator.SetIKPosition(AvatarIKGoal.RightHand, rightHandTarget.position);
            animator.SetIKRotation(AvatarIKGoal.RightHand, rightHandTarget.rotation);
        }

        // Left Foot IK
        if (leftFootTarget != null)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.LeftFoot, leftFootWeight);
            animator.SetIKRotationWeight(AvatarIKGoal.LeftFoot, leftFootWeight);
            animator.SetIKPosition(AvatarIKGoal.LeftFoot, leftFootTarget.position);
            animator.SetIKRotation(AvatarIKGoal.LeftFoot, leftFootTarget.rotation);
        }

        // Right Foot IK
        if (rightFootTarget != null)
        {
            animator.SetIKPositionWeight(AvatarIKGoal.RightFoot, rightFootWeight);
            animator.SetIKRotationWeight(AvatarIKGoal.RightFoot, rightFootWeight);
            animator.SetIKPosition(AvatarIKGoal.RightFoot, rightFootTarget.position);
            animator.SetIKRotation(AvatarIKGoal.RightFoot, rightFootTarget.rotation);
        }

        // Look At IK
        if (lookAtTarget != null)
        {
            animator.SetLookAtWeight(lookAtWeight);
            animator.SetLookAtPosition(lookAtTarget.position);
        }
    }

    void Update()
    {
        // Control IK weights
        if (Input.GetKey(KeyCode.Q))
        {
            leftHandWeight = Mathf.Lerp(leftHandWeight, 1f, Time.deltaTime * 2f);
        }
        else
        {
            leftHandWeight = Mathf.Lerp(leftHandWeight, 0f, Time.deltaTime * 2f);
        }

        if (Input.GetKey(KeyCode.E))
        {
            rightHandWeight = Mathf.Lerp(rightHandWeight, 1f, Time.deltaTime * 2f);
        }
        else
        {
            rightHandWeight = Mathf.Lerp(rightHandWeight, 0f, Time.deltaTime * 2f);
        }
    }
}
```

### IK với Raycast

```csharp
public class IKWithRaycast : MonoBehaviour
{
    private Animator animator;

    [Header("IK Settings")]
    public float ikWeight = 1f;
    public LayerMask groundLayerMask;
    public float raycastDistance = 2f;

    private Vector3 leftFootIKPosition;
    private Vector3 rightFootIKPosition;
    private Quaternion leftFootIKRotation;
    private Quaternion rightFootIKRotation;

    void Start()
    {
        animator = GetComponent<Animator>();
    }

    void OnAnimatorIK(int layerIndex)
    {
        // Left Foot IK
        animator.SetIKPositionWeight(AvatarIKGoal.LeftFoot, ikWeight);
        animator.SetIKRotationWeight(AvatarIKGoal.LeftFoot, ikWeight);
        animator.SetIKPosition(AvatarIKGoal.LeftFoot, leftFootIKPosition);
        animator.SetIKRotation(AvatarIKGoal.LeftFoot, leftFootIKRotation);

        // Right Foot IK
        animator.SetIKPositionWeight(AvatarIKGoal.RightFoot, ikWeight);
        animator.SetIKRotationWeight(AvatarIKGoal.RightFoot, ikWeight);
        animator.SetIKPosition(AvatarIKGoal.RightFoot, rightFootIKPosition);
        animator.SetIKRotation(AvatarIKGoal.RightFoot, rightFootIKRotation);
    }

    void Update()
    {
        // Raycast for left foot
        RaycastHit leftHit;
        if (Physics.Raycast(transform.position + Vector3.left * 0.5f, Vector3.down, out leftHit, raycastDistance, groundLayerMask))
        {
            leftFootIKPosition = leftHit.point;
            leftFootIKRotation = Quaternion.FromToRotation(Vector3.up, leftHit.normal);
        }

        // Raycast for right foot
        RaycastHit rightHit;
        if (Physics.Raycast(transform.position + Vector3.right * 0.5f, Vector3.down, out rightHit, raycastDistance, groundLayerMask))
        {
            rightFootIKPosition = rightHit.point;
            rightFootIKRotation = Quaternion.FromToRotation(Vector3.up, rightHit.normal);
        }
    }
}
```

## 🎮 6. Animation từ Code

### Tweening Animations

```csharp
public class TweenAnimations : MonoBehaviour
{
    public float moveSpeed = 2f;
    public float rotateSpeed = 90f;
    public float scaleSpeed = 1f;

    private Vector3 originalPosition;
    private Vector3 originalScale;
    private Quaternion originalRotation;

    void Start()
    {
        originalPosition = transform.position;
        originalScale = transform.localScale;
        originalRotation = transform.rotation;
    }

    void Update()
    {
        // Move animation
        if (Input.GetKey(KeyCode.W))
        {
            Vector3 targetPosition = originalPosition + Vector3.forward * 2f;
            transform.position = Vector3.Lerp(transform.position, targetPosition, moveSpeed * Time.deltaTime);
        }

        // Rotate animation
        if (Input.GetKey(KeyCode.Q))
        {
            transform.Rotate(0, rotateSpeed * Time.deltaTime, 0);
        }

        // Scale animation
        if (Input.GetKey(KeyCode.E))
        {
            Vector3 targetScale = originalScale * 1.5f;
            transform.localScale = Vector3.Lerp(transform.localScale, targetScale, scaleSpeed * Time.deltaTime);
        }

        // Reset
        if (Input.GetKey(KeyCode.R))
        {
            transform.position = Vector3.Lerp(transform.position, originalPosition, moveSpeed * Time.deltaTime);
            transform.localScale = Vector3.Lerp(transform.localScale, originalScale, scaleSpeed * Time.deltaTime);
            transform.rotation = Quaternion.Lerp(transform.rotation, originalRotation, rotateSpeed * Time.deltaTime);
        }
    }
}
```

### Coroutine Animations

```csharp
public class CoroutineAnimations : MonoBehaviour
{
    public float animationDuration = 1f;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            StartCoroutine(ScaleAnimation());
        }

        if (Input.GetKeyDown(KeyCode.F))
        {
            StartCoroutine(FadeAnimation());
        }

        if (Input.GetKeyDown(KeyCode.G))
        {
            StartCoroutine(MoveAnimation());
        }
    }

    IEnumerator ScaleAnimation()
    {
        Vector3 originalScale = transform.localScale;
        Vector3 targetScale = originalScale * 2f;

        float elapsedTime = 0f;

        while (elapsedTime < animationDuration)
        {
            float t = elapsedTime / animationDuration;
            t = Mathf.SmoothStep(0f, 1f, t); // Smooth interpolation

            transform.localScale = Vector3.Lerp(originalScale, targetScale, t);

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        // Đảm bảo scale chính xác
        transform.localScale = targetScale;

        // Scale về lại
        elapsedTime = 0f;
        while (elapsedTime < animationDuration)
        {
            float t = elapsedTime / animationDuration;
            t = Mathf.SmoothStep(0f, 1f, t);

            transform.localScale = Vector3.Lerp(targetScale, originalScale, t);

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.localScale = originalScale;
    }

    IEnumerator FadeAnimation()
    {
        Renderer renderer = GetComponent<Renderer>();
        Color originalColor = renderer.material.color;

        float elapsedTime = 0f;

        while (elapsedTime < animationDuration)
        {
            float t = elapsedTime / animationDuration;

            Color newColor = originalColor;
            newColor.a = Mathf.Lerp(1f, 0f, t);
            renderer.material.color = newColor;

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        // Fade in
        elapsedTime = 0f;
        while (elapsedTime < animationDuration)
        {
            float t = elapsedTime / animationDuration;

            Color newColor = originalColor;
            newColor.a = Mathf.Lerp(0f, 1f, t);
            renderer.material.color = newColor;

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        renderer.material.color = originalColor;
    }

    IEnumerator MoveAnimation()
    {
        Vector3 originalPosition = transform.position;
        Vector3 targetPosition = originalPosition + Vector3.up * 3f;

        float elapsedTime = 0f;

        while (elapsedTime < animationDuration)
        {
            float t = elapsedTime / animationDuration;
            t = Mathf.Sin(t * Mathf.PI); // Smooth curve

            transform.position = Vector3.Lerp(originalPosition, targetPosition, t);

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.position = originalPosition;
    }
}
```

## 🎮 Bài tập thực hành nâng cao

### Bài tập 1: Advanced Audio System

Tạo Audio System với:

- Audio mixing với ducking và fading
- Audio pooling cho performance
- Spatial audio với reverb zones
- Dynamic music system với transitions
- Audio visualization với frequency analysis

### Bài tập 2: Complex Animation System

Tạo Animation System với:

- Multi-layer character animation
- IK system cho realistic movement
- Animation curves cho procedural animations
- Blend trees cho complex movement
- Animation events cho gameplay integration

### Bài tập 3: Procedural Animation System

Tạo Procedural Animation với:

- Animation curves cho custom easing
- IK system cho object interaction
- Dynamic animation blending
- Animation state machine với complex transitions
- Performance optimization techniques

## ✅ Checklist hoàn thành nâng cao

- [ ] Hiểu Audio Source và Audio Clip với best practices
- [ ] Phân biệt PlayOneShot vs Play và khi nào dùng
- [ ] Thành thạo Animator Controller và State Machine
- [ ] Tạo Animation Clips với Animation Curves
- [ ] Sử dụng Animation Parameters và Blend Trees
- [ ] Trigger animations từ code với Animation Events
- [ ] Thành thạo Animation Layers và Blend Modes
- [ ] Hiểu IK (Inverse Kinematics) cơ bản
- [ ] Sử dụng Audio Mixing và Audio Groups
- [ ] Tạo procedural animations với Animation Curves
- [ ] Hoàn thành ít nhất 2 bài tập nâng cao

## 🚀 Tiếp theo

Bạn đã nắm vững Audio & Animation cơ bản VÀ nâng cao! Giờ bạn có thể:

- Tạo complex animation systems với IK
- Implement advanced audio mixing
- Sử dụng Animation Curves cho procedural animations
- Design realistic character animations

**Bài tiếp theo**: [Resources & Best Practices](./07-resources.md)

---

💡 **Tips nâng cao**:

- **Animation Curves** mở ra nhiều possibilities cho procedural animations
- **IK** rất quan trọng cho realistic character movement
- **Audio Mixing** giúp tạo immersive audio experience
- **Blend Modes** cho phép complex animation layering
- **Animation Events** là bridge giữa animation và gameplay
