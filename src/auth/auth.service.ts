import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';

export interface AuthPayload {
  id: number;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthPayload;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private toPayload(user: User): AuthPayload {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }

  private signAccessToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(userId: number) {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
    return token;
  }

  private async issueAuthResponse(user: User): Promise<AuthResponse> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);
    return {
      accessToken,
      refreshToken,
      user: this.toPayload(user),
    };
  }

  private async revokeRefreshToken(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashed,
      name: dto.name,
    });

    return this.issueAuthResponse(user);
  }

  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.issueAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        token: dto.refreshToken,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!stored || !stored.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.revokeRefreshToken(dto.refreshToken);
    return this.issueAuthResponse(stored.user);
  }

  async logout(userId: number, dto: RefreshTokenDto) {
    await this.prisma.refreshToken.updateMany({
      where: { token: dto.refreshToken, userId },
      data: { revoked: true },
    });
    return { success: true };
  }
}
