import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateCommitteeMemberDto } from './dto/create-committee-member.dto';
import { CreateCommitteePositionDto } from './dto/create-committee-position.dto';
import { UpdateCommitteeMemberDto } from './dto/update-committee-member.dto';
import { UpdateCommitteePositionDto } from './dto/update-committee-position.dto';
import { CreateVipGuestDto } from './dto/create-vip-guest.dto';
import { UpdateVipGuestDto } from './dto/update-vip-guest.dto';
import { TagsService } from './tags.service';

@Controller('admin/tags')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CsrfGuard)
@Roles('organizer', 'super_admin')
@RequirePermissions('tags.manage')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  listTags(@Query('event') eventSlug: string) {
    return this.tags.listTags(eventSlug);
  }

  @Get('committee')
  listCommittee(@Query('event') eventSlug: string) {
    return this.tags.listCommittee(eventSlug);
  }

  @Post('positions')
  createPosition(
    @Body() dto: CreateCommitteePositionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.createPosition(dto, user.sub);
  }

  @Patch('positions/:id')
  updatePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitteePositionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.updatePosition(id, dto, user.sub);
  }

  @Delete('positions/:id')
  deletePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.removePosition(id, user.sub);
  }

  @Post('committee')
  createMember(
    @Body() dto: CreateCommitteeMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.createMember(dto, user.sub);
  }

  @Patch('committee/:id')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitteeMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.updateMember(id, dto, user.sub);
  }

  @Delete('committee/:id')
  deleteMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.removeMember(id, user.sub);
  }

  @Get('vips')
  listVips(@Query('event') eventSlug: string) {
    return this.tags.listVips(eventSlug);
  }

  @Post('vips')
  createVip(@Body() dto: CreateVipGuestDto, @CurrentUser() user: JwtPayload) {
    return this.tags.createVip(dto, user.sub);
  }

  @Patch('vips/:id')
  updateVip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVipGuestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.updateVip(id, dto, user.sub);
  }

  @Delete('vips/:id')
  deleteVip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tags.removeVip(id, user.sub);
  }
}
