/**
 * Fehmina Hospital & Trauma Centre, Lucknow
 * Shared iPad Patient Feedback Experience Controller
 */

document.addEventListener('DOMContentLoaded', () => {

  const QUESTIONS = [
    {
      key: 'overall_rating',
      category: 'Overall Experience',
      text: 'Aapka Fehmina Hospital mein overall experience kaisa raha?'
    },
    {
      key: 'doctor_rating',
      category: 'Doctor & Medical Care',
      text: 'Doctor aur medical treatment se aap kitne satisfied rahe?'
    },
    {
      key: 'doctor_communication_rating',
      category: 'Doctor Communication',
      text: 'Doctor ne aapko treatment aur condition ke baare mein kitni achhi tarah explain kiya?'
    },
    {
      key: 'nursing_rating',
      category: 'Nursing Staff',
      text: 'Nursing staff ka behaviour aur support kaisa raha?'
    },
    {
      key: 'staff_behaviour_rating',
      category: 'Staff Behaviour',
      text: 'Hospital staff ka overall behaviour kaisa raha?'
    },
    {
      key: 'cleanliness_rating',
      category: 'Cleanliness & Hygiene',
      text: 'Hospital ki cleanliness aur hygiene se aap kitne satisfied rahe?'
    },
    {
      key: 'room_ward_rating',
      category: 'Room / Ward Experience',
      text: 'Room ya ward ka experience kaisa raha?'
    },
    {
      key: 'billing_discharge_rating',
      category: 'Billing & Discharge',
      text: 'Billing aur discharge process aapko kaisa laga?'
    },
    {
      key: 'waiting_time_rating',
      category: 'Service Speed',
      text: 'Service speed aur waiting time kaisa raha?'
    }
  ];

  // DOM Elements
  const stepIndicator = document.getElementById('step-indicator');
  const progressBarFill = document.getElementById('progress-bar-fill');
  
  const stepWelcome = document.getElementById('step-welcome');
  const stepPatientInfo = document.getElementById('step-patient-info');
  const stepQuestion = document.getElementById('step-question');
  const stepWritten = document.getElementById('step-written');
  const stepStaff = document.getElementById('step-staff');
  const stepSuccess = document.getElementById('step-success');

  const btnStartFlow = document.getElementById('btn-start-flow');
  
  // Patient Info Elements
  const patientNameInput = document.getElementById('patient_name');
  const patientPhoneInput = document.getElementById('patient_phone');
  const patientDeptSelect = document.getElementById('patient_department');
  const customDeptWrap = document.getElementById('custom-dept-wrap');
  const patientCustomDeptInput = document.getElementById('patient_custom_dept');
  const patientAddressInput = document.getElementById('patient_address');
  const patientInfoError = document.getElementById('patient-info-error');
  const patientInfoErrorMsg = document.getElementById('patient-info-error-msg');
  const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
  const btnNextPatientInfo = document.getElementById('btn-next-patient-info');

  // Department "Other" toggle
  if (patientDeptSelect) {
    patientDeptSelect.addEventListener('change', () => {
      if (patientDeptSelect.value === 'Other') {
        customDeptWrap.classList.remove('hidden');
        patientCustomDeptInput.focus();
      } else {
        customDeptWrap.classList.add('hidden');
      }
    });
  }

  // Question Elements
  const qCategoryDisplay = document.getElementById('q-category-display');
  const qTextDisplay = document.getElementById('q-text-display');
  const qHintDisplay = document.getElementById('q-hint-display');
  const ratingPillButtons = document.querySelectorAll('.rating-pill-btn');
  const btnPrevQuestion = document.getElementById('btn-prev-question');

  // Written Step Elements
  const writtenFeedbackInput = document.getElementById('written_feedback');
  const btnBackToQ9 = document.getElementById('btn-back-to-q9');
  const btnSkipWritten = document.getElementById('btn-skip-written');
  const btnNextWritten = document.getElementById('btn-next-written');

  // Staff Step Elements
  const staffNameInput = document.getElementById('staff_of_month_name_text');
  const staffReasonInput = document.getElementById('staff_appreciation_reason');
  const btnBackToWritten = document.getElementById('btn-back-to-written');
  const btnSkipStaff = document.getElementById('btn-skip-staff');
  const btnFinalSubmit = document.getElementById('btn-final-submit');
  const submitBtnLabel = document.getElementById('submit-btn-label');
  const submitErrorBanner = document.getElementById('submit-error-banner');
  const submitErrorMsg = document.getElementById('submit-error-msg');

  // Success Step Elements
  const dispFinalId = document.getElementById('disp-final-id');
  const btnNextPatient = document.getElementById('btn-next-patient');

  const sourceTagBox = document.getElementById('source-tag-box');
  const sourceTagText = document.getElementById('source-tag-text');

  // Runtime State
  const DRAFT_KEY = 'fehmina_ipad_draft_temp';
  let currentQuestionIndex = 0;
  let currentSubmissionId = '';
  let isSubmitting = false;

  const userAnswers = {
    patient_name: '',
    patient_phone: '',
    patient_address: '',
    overall_rating: null,
    doctor_rating: null,
    doctor_communication_rating: null,
    nursing_rating: null,
    staff_behaviour_rating: null,
    cleanliness_rating: null,
    room_ward_rating: null,
    billing_discharge_rating: null,
    waiting_time_rating: null,
    written_feedback: '',
    staff_of_month_name_text: '',
    staff_appreciation_reason: ''
  };

  // 1. Parse URL Parameters (?dept=IPD&ward=General)
  const urlParams = new URLSearchParams(window.location.search);
  const paramDept = urlParams.get('dept') || '';
  const paramWard = urlParams.get('ward') || '';
  const paramSource = urlParams.get('source') || 'hospital_ipad';

  if (paramDept || paramWard) {
    sourceTagBox.classList.remove('hidden');
    sourceTagText.textContent = [paramDept, paramWard].filter(Boolean).join(' • ');
  }

  // 2. Fetch runtime config
  fetch('/api/config')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.config && data.config.google_review_url) {
        activeGoogleReviewUrl = data.config.google_review_url;
      }
    })
    .catch(() => {});

  // 3. View Switching Helper
  const allStepSections = [stepWelcome, stepPatientInfo, stepQuestion, stepWritten, stepStaff, stepSuccess];

  function showStep(targetStep) {
    allStepSections.forEach(sec => {
      if (sec) {
        sec.classList.remove('active');
        sec.classList.add('hidden');
      }
    });

    if (targetStep) {
      targetStep.classList.remove('hidden');
      setTimeout(() => {
        targetStep.classList.add('active');
      }, 10);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 4. Step 0: Welcome Screen Start -> Go to Patient Info
  function goToPatientInfoStep() {
    stepIndicator.classList.remove('hidden');
    stepIndicator.textContent = 'Details';
    progressBarFill.style.width = '8%';
    patientInfoError.classList.add('hidden');
    showStep(stepPatientInfo);
  }

  btnStartFlow.addEventListener('click', () => {
    goToPatientInfoStep();
  });

  btnBackToWelcome.addEventListener('click', () => {
    stepIndicator.classList.add('hidden');
    progressBarFill.style.width = '0%';
    showStep(stepWelcome);
  });

  // 5. Patient Info Validation & Proceed to Question 1
  btnNextPatientInfo.addEventListener('click', () => {
    patientInfoError.classList.add('hidden');

    const nameVal = patientNameInput.value.trim();
    const phoneVal = patientPhoneInput.value.trim().replace(/[^0-9]/g, '');
    const deptVal = patientDeptSelect ? patientDeptSelect.value : '';
    const customDeptVal = patientCustomDeptInput ? patientCustomDeptInput.value.trim() : '';
    const addressVal = patientAddressInput.value.trim();

    if (!nameVal) {
      patientInfoErrorMsg.textContent = 'Kripya patient ka naam enter karein.';
      patientInfoError.classList.remove('hidden');
      patientNameInput.focus();
      return;
    }

    if (!phoneVal || phoneVal.length < 10) {
      patientInfoErrorMsg.textContent = 'Kripya ek valid 10-digit mobile number enter karein.';
      patientInfoError.classList.remove('hidden');
      patientPhoneInput.focus();
      return;
    }

    if (!deptVal) {
      patientInfoErrorMsg.textContent = 'Kripya Department / Specialty select karein.';
      patientInfoError.classList.remove('hidden');
      if (patientDeptSelect) patientDeptSelect.focus();
      return;
    }

    let finalDept = deptVal;
    if (deptVal === 'Other') {
      if (!customDeptVal) {
        patientInfoErrorMsg.textContent = 'Kripya specific department ya medical problem ka naam likhein.';
        patientInfoError.classList.remove('hidden');
        if (patientCustomDeptInput) patientCustomDeptInput.focus();
        return;
      }
      finalDept = customDeptVal;
    }

    if (!addressVal) {
      patientInfoErrorMsg.textContent = 'Kripya patient ka address/pata enter karein.';
      patientInfoError.classList.remove('hidden');
      patientAddressInput.focus();
      return;
    }

    userAnswers.patient_name = nameVal;
    userAnswers.patient_phone = phoneVal;
    userAnswers.department = finalDept;
    userAnswers.patient_address = addressVal;

    // Start with Question 1
    currentQuestionIndex = 0;
    renderCurrentQuestion();
  });

  // 6. Render Question by Index (0 to 8)
  function renderCurrentQuestion() {
    const q = QUESTIONS[currentQuestionIndex];
    if (!q) return;

    stepIndicator.classList.remove('hidden');
    stepIndicator.textContent = (currentQuestionIndex + 1) + ' / 9';
    
    // Progress calculation (15% to 80%)
    const pct = 15 + ((currentQuestionIndex + 1) / 9) * 65;
    progressBarFill.style.width = pct + '%';

    qCategoryDisplay.textContent = q.category;
    qTextDisplay.textContent = q.text;
    if (q.hint && q.hint.trim().length > 0) {
      qHintDisplay.textContent = q.hint;
      qHintDisplay.classList.remove('hidden');
    } else {
      qHintDisplay.textContent = '';
      qHintDisplay.classList.add('hidden');
    }

    // Highlight previously chosen rating if any
    const savedVal = userAnswers[q.key];
    ratingPillButtons.forEach(btn => {
      const val = parseInt(btn.getAttribute('data-rating'));
      if (savedVal === val) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    showStep(stepQuestion);
  }

  // 7. Handle Rating Selection (Smooth Auto-Transition)
  ratingPillButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const selectedRating = parseInt(btn.getAttribute('data-rating'));
      const q = QUESTIONS[currentQuestionIndex];
      
      userAnswers[q.key] = selectedRating;

      // Visual feedback
      ratingPillButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Auto-advance with natural micro-pause (220ms)
      setTimeout(() => {
        if (currentQuestionIndex < QUESTIONS.length - 1) {
          currentQuestionIndex++;
          renderCurrentQuestion();
        } else {
          goToWrittenStep();
        }
      }, 220);
    });
  });

  // Previous button in question screen
  btnPrevQuestion.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      renderCurrentQuestion();
    } else {
      goToPatientInfoStep();
    }
  });

  // 8. Step: Written Feedback Navigation
  function goToWrittenStep() {
    stepIndicator.textContent = 'Feedback';
    progressBarFill.style.width = '88%';
    showStep(stepWritten);
  }

  btnBackToQ9.addEventListener('click', () => {
    currentQuestionIndex = QUESTIONS.length - 1;
    renderCurrentQuestion();
  });

  btnSkipWritten.addEventListener('click', () => {
    userAnswers.written_feedback = '';
    writtenFeedbackInput.value = '';
    goToStaffStep();
  });

  btnNextWritten.addEventListener('click', () => {
    userAnswers.written_feedback = writtenFeedbackInput.value.trim();
    goToStaffStep();
  });

  // 9. Step: Staff Recognition Navigation
  function goToStaffStep() {
    stepIndicator.textContent = 'Staff';
    progressBarFill.style.width = '96%';
    submitErrorBanner.classList.add('hidden');
    showStep(stepStaff);
  }

  btnBackToWritten.addEventListener('click', () => {
    goToWrittenStep();
  });

  btnSkipStaff.addEventListener('click', () => {
    userAnswers.staff_of_month_name_text = '';
    userAnswers.staff_appreciation_reason = '';
    staffNameInput.value = '';
    staffReasonInput.value = '';
    submitFinalFeedback();
  });

  btnFinalSubmit.addEventListener('click', () => {
    userAnswers.staff_of_month_name_text = staffNameInput.value.trim();
    userAnswers.staff_appreciation_reason = staffReasonInput.value.trim();
    submitFinalFeedback();
  });

  // 10. Final Form Submission with Double-Submission Protection
  async function submitFinalFeedback() {
    if (isSubmitting) return; // Prevent double-tap submissions
    
    submitErrorBanner.classList.add('hidden');

    // Verify all mandatory patient info is present
    if (!userAnswers.patient_name || !userAnswers.patient_phone || !userAnswers.patient_address) {
      goToPatientInfoStep();
      return;
    }

    // Verify all 9 ratings are filled
    for (let i = 0; i < QUESTIONS.length; i++) {
      const qKey = QUESTIONS[i].key;
      if (!userAnswers[qKey]) {
        currentQuestionIndex = i;
        renderCurrentQuestion();
        return;
      }
    }

    // Prepare Payload
    const payload = {
      patient_name: userAnswers.patient_name,
      patient_phone: userAnswers.patient_phone,
      patient_address: userAnswers.patient_address,
      department: userAnswers.department || paramDept || 'General',
      ward: paramWard || 'General',
      overall_rating: userAnswers.overall_rating,
      doctor_rating: userAnswers.doctor_rating,
      doctor_communication_rating: userAnswers.doctor_communication_rating,
      nursing_rating: userAnswers.nursing_rating,
      staff_behaviour_rating: userAnswers.staff_behaviour_rating,
      cleanliness_rating: userAnswers.cleanliness_rating,
      room_ward_rating: userAnswers.room_ward_rating,
      billing_discharge_rating: userAnswers.billing_discharge_rating,
      waiting_time_rating: userAnswers.waiting_time_rating,
      written_feedback: writtenFeedbackInput.value.trim(),
      staff_of_month_name_text: staffNameInput.value.trim(),
      staff_appreciation_reason: staffReasonInput.value.trim(),
      management_contact_requested: 0,
      source_qr: paramSource
    };

    // Lock Submit Button (Double Submission Prevention)
    isSubmitting = true;
    btnFinalSubmit.disabled = true;
    btnSkipStaff.disabled = true;
    submitBtnLabel.textContent = 'Submitting...';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Feedback submit nahi ho paya. Please try again.');
      }

      currentSubmissionId = data.submission_id;

      // Transition to Success Screen
      renderSuccessScreen(currentSubmissionId);

    } catch (err) {
      submitErrorMsg.textContent = err.message || 'Feedback submit nahi ho paya. Please try again.';
      submitErrorBanner.classList.remove('hidden');
    } finally {
      isSubmitting = false;
      btnFinalSubmit.disabled = false;
      btnSkipStaff.disabled = false;
      submitBtnLabel.textContent = 'Submit Feedback';
    }
  }

  // 11. Render Success Screen
  function renderSuccessScreen(subId) {
    stepIndicator.classList.add('hidden');
    progressBarFill.style.width = '100%';
    if (dispFinalId) {
      dispFinalId.textContent = subId;
    }
    showStep(stepSuccess);
  }

  // 12. SHARED IPAD COMPLETE RESET ("Next Patient ->")
  function resetApplicationForNextPatient() {
    // 1. Clear all in-memory answers
    Object.keys(userAnswers).forEach(k => {
      userAnswers[k] = (typeof userAnswers[k] === 'number') ? null : '';
    });
    
    // 2. Clear state flags
    currentSubmissionId = '';
    isSubmitting = false;

    // 3. Clear all DOM input values
    patientNameInput.value = '';
    patientPhoneInput.value = '';
    if (patientDeptSelect) patientDeptSelect.value = '';
    if (patientCustomDeptInput) patientCustomDeptInput.value = '';
    if (customDeptWrap) customDeptWrap.classList.add('hidden');
    patientAddressInput.value = '';
    writtenFeedbackInput.value = '';
    staffNameInput.value = '';
    staffReasonInput.value = '';

    // 4. Clear all rating selected button states
    ratingPillButtons.forEach(b => b.classList.remove('selected'));

    // 5. Reset UI progress & step indicators
    currentQuestionIndex = 0;
    stepIndicator.classList.add('hidden');
    progressBarFill.style.width = '0%';
    patientInfoError.classList.add('hidden');
    submitErrorBanner.classList.add('hidden');

    // 6. Clear browser storage (Shared device privacy)
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.clear();
    } catch (e) {}

    // 7. Return to Welcome Screen in pristine state
    showStep(stepWelcome);
  }

  // Bind Next Patient button
  btnNextPatient.addEventListener('click', () => {
    resetApplicationForNextPatient();
  });

});
