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
  ],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class LoginComponent {
  form!: FormGroup;
  loading = false;
  showPassword = false;

  private readonly USERNAME_PATTERN = /^\d{1,10}\.[A-Za-z]{2,}$/;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: NzMessageService
  ) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      username: this.fb.control('', {
        validators: [
          Validators.required,
          Validators.maxLength(30),
          Validators.pattern(this.USERNAME_PATTERN),
        ],
        updateOn: 'blur',
      }),
      password: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  get usernameCtrl() {
    return this.form.get('username');
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

    const payload = {
      username: String(this.form.value.username || '').trim(),
      password: String(this.form.value.password || ''),
    };

    this.auth.login(payload).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);

        localStorage.setItem('UserData', JSON.stringify(res.user));

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

  onUsernameInput(event: Event) {
    const input = event.target as HTMLInputElement;

    let v = input.value.replace(/[^0-9A-Za-z.]/g, '');

    v = v.toUpperCase();

    input.value = v;
    this.usernameCtrl?.setValue(v, { emitEvent: false });
  }
}
