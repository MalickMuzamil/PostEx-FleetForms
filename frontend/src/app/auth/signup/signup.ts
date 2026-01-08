import { Component } from '@angular/core';
import {
  FormBuilder,
  Validators,
  AbstractControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { AppValidators } from '../../core/services/validators';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  standalone: true,
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  loading = false;
  showPassword = false;

  form!: any;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) {
    this.form = this.fb.group(
      {
        name: ['', [Validators.required, AppValidators.name(15)]],
        email: this.fb.control('', { validators: [Validators.required, AppValidators.email(30)], updateOn: 'blur' }),
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.matchPasswords }
    );
  }

  // getters
  get nameCtrl() {
    return this.form.get('name');
  }
  get emailCtrl() {
    return this.form.get('email');
  }
  get passwordCtrl() {
    return this.form.get('password');
  }
  get confirmPasswordCtrl() {
    return this.form.get('confirmPassword');
  }

  // confirm password validator
  matchPasswords(group: AbstractControl) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;

    if (!pass || !confirm) return null;

    return pass === confirm ? null : { passwordMismatch: true };
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.msg.error('Please fix validation errors first.');
      return;
    }

    this.loading = true;

    const { name, email, password } = this.form.value;

    this.auth.signup({ name, email, password }).subscribe({
      next: () => {
        this.loading = false;
        this.msg.success('Account created successfully ✅');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.loading = false;
        this.msg.error(err?.error?.message || 'Signup failed');
      },
    });
  }
}
