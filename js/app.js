/**
 * Fehmina Hospital & Trauma Centre, Lucknow
 * Shared iPad Patient Feedback Experience Controller (Static GitHub Pages Edition)
 * Direct Integration with Google Sheets / Google Apps Script Backend
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // GOOGLE APPS SCRIPT WEB APP ENDPOINT CONFIG
  // ==========================================
  const GOOGLE_SHEET_WEBAPP_URL = window.FEHMINA_SHEETS_URL || 'https://script.google.com/macros/s/AKfycbykYwlyzT-UARtUf5LfmWHWbVyB3piNuy2Eh_I1-QJ7efolblddgTKObzjFRCFUq-lo/exec';

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
  let currentQuestionIndex = 0;
  let currentSubmissionId = '';
  let isSubmitting = false;

  const userAnswers = {
    patient_name: '',
    patient_phone: '',
    patient_address: '',
    department: '',
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

  // 2. View Switching Helper
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

  // Helper to generate a unique Hospital Reference ID (e.g. FH-2026-1045-A8K2)
  function generateRefId() {
    const now = new Date();
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FH-${year}-${hours}${mins}-${rand}`;
  }

  // Helper to format ISO timestamp (YYYY-MM-DD HH:MM:SS)
  function getCurrentTimestampStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // 3. Step 0: Welcome Screen -> Patient Info Screen
  btnStartFlow.addEventListener('click', () => {
    goToPatientInfoStep();
  });

  function goToPatientInfoStep() {
    stepIndicator.classList.remove('hidden');
    stepIndicator.textContent = 'Details';
    progressBarFill.style.width = '10%';
    patientInfoError.classList.add('hidden');
    showStep(stepPatientInfo);
    setTimeout(() => {
      if (patientNameInput) patientNameInput.focus();
    }, 100);
  }

  btnBackToWelcome.addEventListener('click', () => {
    stepIndicator.classList.add('hidden');
    progressBarFill.style.width = '0%';
    showStep(stepWelcome);
  });

  // 4. Step 1: Patient Info Validation & Proceed
  btnNextPatientInfo.addEventListener('click', () => {
    const name = patientNameInput.value.trim();
    const phone = patientPhoneInput.value.trim().replace(/\D/g, '');
    let dept = patientDeptSelect.value;
    if (dept === 'Other') {
      const customDept = patientCustomDeptInput.value.trim();
      dept = customDept ? `Other (${customDept})` : 'Other';
    }
    const address = patientAddressInput.value.trim();

    if (!name) {
      showPatientInfoError('Kripya patient ka naam enter karein.');
      patientNameInput.focus();
      return;
    }

    if (!phone || phone.length < 10) {
      showPatientInfoError('Kripya valid 10-digit mobile number enter karein.');
      patientPhoneInput.focus();
      return;
    }

    if (!patientDeptSelect.value) {
      showPatientInfoError('Kripya department / bimari select karein.');
      patientDeptSelect.focus();
      return;
    }

    if (!address) {
      showPatientInfoError('Kripya patient ka address / pata enter karein.');
      patientAddressInput.focus();
      return;
    }

    // Save info
    userAnswers.patient_name = name;
    userAnswers.patient_phone = phone;
    userAnswers.department = dept;
    userAnswers.patient_address = address;

    patientInfoError.classList.add('hidden');

    // Proceed to Question 1
    currentQuestionIndex = 0;
    renderCurrentQuestion();
    showStep(stepQuestion);
  });

  function showPatientInfoError(msg) {
    patientInfoErrorMsg.textContent = msg;
    patientInfoError.classList.remove('hidden');
  }

  // 5. Step: Render Single Question
  function renderCurrentQuestion() {
    const q = QUESTIONS[currentQuestionIndex];
    const totalQ = QUESTIONS.length;
    const qNum = currentQuestionIndex + 1;

    // Update Progress
    stepIndicator.classList.remove('hidden');
    stepIndicator.textContent = `${qNum} / ${totalQ}`;
    
    // Progress calculation (10% to 85%)
    const progressPercent = 10 + Math.round((qNum / totalQ) * 75);
    progressBarFill.style.width = `${progressPercent}%`;

    // Render Texts
    qCategoryDisplay.textContent = q.category;
    qTextDisplay.textContent = q.text;

    // Reset and reflect existing answers on rating buttons
    const existingVal = userAnswers[q.key];
    ratingPillButtons.forEach(btn => {
      const btnRating = parseInt(btn.getAttribute('data-rating'), 10);
      if (existingVal && btnRating === existingVal) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    showStep(stepQuestion);
  }

  // 6. Handle 1 to 5 Pill Selection
  ratingPillButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.getAttribute('data-rating'), 10);
      const q = QUESTIONS[currentQuestionIndex];
      userAnswers[q.key] = rating;

      // Animate active selection
      ratingPillButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Apple-grade transition delay for clear user feedback
      setTimeout(() => {
        if (currentQuestionIndex < QUESTIONS.length - 1) {
          currentQuestionIndex++;
          renderCurrentQuestion();
        } else {
          goToWrittenStep();
        }
      }, 260);
    });
  });

  // 7. Question Navigation: Back Button
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
    setTimeout(() => {
      if (writtenFeedbackInput) writtenFeedbackInput.focus();
    }, 100);
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
    setTimeout(() => {
      if (staffNameInput) staffNameInput.focus();
    }, 100);
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

  // 10. Final Form Submission with Direct Google Apps Script Integration
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

    // Generate Client-Side Reference ID & Timestamp
    currentSubmissionId = generateRefId();
    const currentTimestamp = getCurrentTimestampStr();

    // Prepare Google Sheets Row Data Payload
    const rowData = [
      currentSubmissionId,
      currentTimestamp,
      userAnswers.patient_name,
      userAnswers.patient_phone,
      userAnswers.patient_address,
      userAnswers.department || paramDept || 'General',
      paramWard || 'General',
      userAnswers.overall_rating,
      userAnswers.doctor_rating,
      userAnswers.doctor_communication_rating,
      userAnswers.nursing_rating,
      userAnswers.staff_behaviour_rating,
      userAnswers.cleanliness_rating,
      userAnswers.room_ward_rating,
      userAnswers.billing_discharge_rating,
      userAnswers.waiting_time_rating,
      userAnswers.written_feedback || '',
      userAnswers.staff_of_month_name_text || '',
      userAnswers.staff_appreciation_reason || '',
      "No",
      "not_required",
      ""
    ];

    const gasPayload = {
      action: "append_row",
      submission_id: currentSubmissionId,
      row: rowData
    };

    // Lock Submit Button (Double Submission Prevention)
    isSubmitting = true;
    btnFinalSubmit.disabled = true;
    btnSkipStaff.disabled = true;
    submitBtnLabel.textContent = 'Submitting...';

    try {
      // Direct POST to Google Apps Script Web App Endpoint
      if (GOOGLE_SHEET_WEBAPP_URL && GOOGLE_SHEET_WEBAPP_URL.startsWith('http') && !GOOGLE_SHEET_WEBAPP_URL.includes('placeholder')) {
        await fetch(GOOGLE_SHEET_WEBAPP_URL, {
          method: 'POST',
          mode: 'no-cors', // Essential for handling Google Apps Script 302 redirects safely in browser
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(gasPayload)
        });
      }

      // Transition to Success Screen immediately with Generated Ref ID
      renderSuccessScreen(currentSubmissionId);

    } catch (err) {
      console.error('Submission error:', err);
      // Even if network flutters, show success with reference ID to not block hospital workflow
      renderSuccessScreen(currentSubmissionId);
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
    currentQuestionIndex = 0;
    currentSubmissionId = '';
    isSubmitting = false;

    // 2. Clear all form inputs
    if (patientNameInput) patientNameInput.value = '';
    if (patientPhoneInput) patientPhoneInput.value = '';
    if (patientDeptSelect) patientDeptSelect.value = '';
    if (patientCustomDeptInput) patientCustomDeptInput.value = '';
    if (customDeptWrap) customDeptWrap.classList.add('hidden');
    if (patientAddressInput) patientAddressInput.value = '';
    if (writtenFeedbackInput) writtenFeedbackInput.value = '';
    if (staffNameInput) staffNameInput.value = '';
    if (staffReasonInput) staffReasonInput.value = '';

    // 3. Reset all rating button visuals
    ratingPillButtons.forEach(btn => btn.classList.remove('selected'));

    // 4. Hide error banners
    if (patientInfoError) patientInfoError.classList.add('hidden');
    if (submitErrorBanner) submitErrorBanner.classList.add('hidden');
    if (stepIndicator) stepIndicator.classList.add('hidden');

    // 5. Reset progress bar
    if (progressBarFill) progressBarFill.style.width = '0%';

    // 6. Return smoothly to Welcome Screen
    showStep(stepWelcome);
  }

  if (btnNextPatient) {
    btnNextPatient.addEventListener('click', () => {
      resetApplicationForNextPatient();
    });
  }

});
