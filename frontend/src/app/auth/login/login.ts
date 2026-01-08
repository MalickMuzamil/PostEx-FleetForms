import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth-service';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AppValidators } from '../../core/services/validators';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    ReactiveFormsModule,
    CommonModule,
    RouterLink,
  ],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class LoginComponent {
  form!: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: this.fb.control('', { validators: [Validators.required, AppValidators.email(30)], updateOn: 'blur' }),
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get emailCtrl() {
    return this.form.get('email');
  }

  get passwordCtrl() {
    return this.form.get('password');
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.msg.error('Please fix validation errors first.');
      return;
    }

    this.loading = true;

    const payload = this.form.value as { email: string; password: string };

    this.auth.login(payload).subscribe({
      next: (res: any) => {
        if (res?.token) localStorage.setItem('token', res.token);

        this.auth.setAuthenticated(true);

        this.msg.success('Login successful ✅');
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        const message = err?.error?.message || 'Login failed';
        this.msg.error(message);
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
