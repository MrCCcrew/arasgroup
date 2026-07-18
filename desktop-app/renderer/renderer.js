const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const apiUrlInput = document.getElementById('apiUrl');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginSpinner = document.getElementById('loginSpinner');
const errorDiv = document.getElementById('error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const apiUrl = apiUrlInput.value.trim();

  if (!email || !password || !apiUrl) {
    showError('الرجاء ملء جميع الحقول');
    return;
  }

  setLoading(true);
  hideError();

  try {
    const result = await window.electronAPI.login({
      email,
      password,
      apiUrl,
    });

    if (result.success) {
      // Login successful - window will be hidden by main process
      console.log('Login successful');
    } else {
      showError(result.error || 'فشل تسجيل الدخول');
      setLoading(false);
    }
  } catch (error) {
    showError('حدث خطأ في الاتصال: ' + error.message);
    setLoading(false);
  }
});

function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtnText.style.display = loading ? 'none' : 'inline';
  loginSpinner.style.display = loading ? 'inline-block' : 'none';
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function hideError() {
  errorDiv.style.display = 'none';
}

// Focus first input on load
emailInput.focus();
